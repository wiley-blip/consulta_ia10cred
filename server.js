// ============================================================
// CARREGAR VARIÁVEIS DE AMBIENTE
// ============================================================

require('dotenv').config();


// ============================================================
// IMPORTAR DEPENDÊNCIAS
// ============================================================

const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const xlsx = require('xlsx');
const { token_request } = require('./autenticacao.js');
const { consultarContratosRefinanciamento } = require('./consultarContratosRefinanciamento.js');


// ============================================================
// INICIALIZAR EXPRESS
// ============================================================

const app = express();
const PORT = process.env.PORT || 3000;


// ============================================================
// CONFIGURAR MULTER PARA UPLOAD
// ============================================================

const uploadDir = path.join(__dirname, 'upload', 'dados');
const historicoDir = path.join(__dirname, 'historico');

// Garantir que as pastas existem
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}
if (!fs.existsSync(historicoDir)) {
    fs.mkdirSync(historicoDir, { recursive: true });
}

const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const timestamp = Date.now();
        cb(null, `${timestamp}-${file.originalname}`);
    }
});

const upload = multer({
    storage: storage,
    fileFilter: (req, file, cb) => {
        const extensoesPermitidas = ['.xlsx', '.xls'];
        const ext = path.extname(file.originalname).toLowerCase();
        
        if (extensoesPermitidas.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Apenas arquivos .xlsx ou .xls são permitidos'));
        }
    }
});


// ============================================================
// MIDDLEWARES
// ============================================================

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static(path.join(__dirname, 'public')));


// ============================================================
// ROTA: CONSULTAR CONTRATOS
// ============================================================

app.post('/api/consultar', async (req, res) => {
    try {
        const { cpf } = req.body;

        if (!cpf) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'CPF é obrigatório'
            });
        }

        console.log('[API] Consultando contratos para CPF:', cpf);

        // Obter token
        const TOKEN = await token_request();

        if (!TOKEN) {
            return res.status(401).json({
                sucesso: false,
                mensagem: 'Falha ao obter token de autenticação'
            });
        }

        // Consultar contratos
        const resultado = await consultarContratosRefinanciamento({
            token: TOKEN,
            cpf: cpf,
            tipo_operacao: 14
        });

        return res.json(resultado);

    } catch (erro) {
        console.error('[API] Erro:', erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: erro instanceof Error ? erro.message : 'Erro ao consultar contratos'
        });
    }
});


// ============================================================
// ROTA: UPLOAD DE ARQUIVO EXCEL
// ============================================================

app.post('/api/upload', upload.single('arquivo'), (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Nenhum arquivo foi enviado'
            });
        }

        console.log('[API] Processando arquivo:', req.file.filename);

        // Ler o arquivo Excel
        const filePath = req.file.path;
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        
        // Converter para JSON
        const dados = xlsx.utils.sheet_to_json(worksheet, {
            header: 1, // Retorna array de arrays
            defval: ''
        });

        // Processar dados: pegar nome e CPF
        const pessoas = [];
        
        // Começar do índice 1 para pular cabeçalho (se existir)
        const inicioLeitura = dados[0] && dados[0][0] && isNaN(dados[0][0]) ? 1 : 0;

        for (let i = inicioLeitura; i < dados.length; i++) {
            const row = dados[i];
            if (row[0] && row[1]) { // Se tem nome e CPF
                pessoas.push({
                    nome: String(row[0]).trim(),
                    cpf: String(row[1]).trim().replace(/\D/g, '') // Remove caracteres não numéricos
                });
            }
        }

        console.log(`[API] ${pessoas.length} pessoas encontradas no arquivo`);

        return res.json({
            sucesso: true,
            mensagem: `${pessoas.length} pessoas encontradas`,
            nomeArquivo: req.file.filename,
            pessoas: pessoas
        });

    } catch (erro) {
        console.error('[API] Erro ao processar arquivo:', erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao processar arquivo: ' + erro.message
        });
    }
});


// ============================================================
// ROTA: EXPORTAR EXCEL COM DADOS DE SUCESSO
// ============================================================

app.post('/api/exportar-excel', (req, res) => {
    try {
        const { dados } = req.body;

        console.log('[API] Recebido para exportar:', dados ? dados.length : 0, 'registros');

        if (!dados || !Array.isArray(dados) || dados.length === 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Nenhum dado para exportar'
            });
        }

        // Preparar dados para o Excel
        const linhas = [];

        // Processar cada pessoa com seus contratos
        dados.forEach((item, idx) => {
            try {
                console.log(`[API] Processando item ${idx}: ${item.nome}`);

                // Se tem contratos no objeto dados.lista_contratos_refin
                if (item.dados && item.dados.lista_contratos_refin && Array.isArray(item.dados.lista_contratos_refin)) {
                    const contratos = item.dados.lista_contratos_refin;
                    
                    // Criar uma linha para cada contrato
                    contratos.forEach((contrato, contratoIdx) => {
                        const row = {
                            'Nome': item.nome,
                            'CPF': item.cpf,
                            'Contrato #': contratoIdx + 1,
                            'Matrícula': contrato.matricula || '',
                            'Proposta': contrato.proposta || '',
                            'Valor Parcela': contrato.valor_parcela || '',
                            'Saldo Devedor': contrato.saldo_devedor || '',
                            'Saldo Devedor Atraso': contrato.saldo_devedor_atraso || '',
                            'Observação': contrato.obs || ''
                        };

                        // Adicionar outros campos dinâmicos
                        Object.keys(contrato).forEach(chave => {
                            if (!row[chave] && chave !== 'matricula' && chave !== 'proposta' && 
                                chave !== 'valor_parcela' && chave !== 'saldo_devedor' && 
                                chave !== 'saldo_devedor_atraso' && chave !== 'obs') {
                                row[chave] = contrato[chave];
                            }
                        });

                        linhas.push(row);
                    });
                } else if (item.dados && Array.isArray(item.dados)) {
                    // Se dados é um array direto (alternativa)
                    item.dados.forEach((contrato, contratoIdx) => {
                        const row = {
                            'Nome': item.nome,
                            'CPF': item.cpf,
                            'Contrato #': contratoIdx + 1
                        };

                        // Adicionar todos os campos do contrato
                        Object.keys(contrato).forEach(chave => {
                            row[chave] = contrato[chave];
                        });

                        linhas.push(row);
                    });
                } else {
                    // Se não tem contratos, criar uma linha apenas com os dados da pessoa
                    const row = {
                        'Nome': item.nome,
                        'CPF': item.cpf,
                        'Status': item.status,
                        'Contratos': 0
                    };
                    linhas.push(row);
                }
            } catch (erroLinha) {
                console.error(`[API] Erro ao processar item ${idx}:`, erroLinha.message);
            }
        });

        console.log('[API] Total de linhas preparadas:', linhas.length);

        if (linhas.length === 0) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Nenhuma linha foi processada'
            });
        }

        // Criar worksheet
        const ws = xlsx.utils.json_to_sheet(linhas);

        // Ajustar largura das colunas
        const colWidths = [];
        if (linhas.length > 0) {
            Object.keys(linhas[0]).forEach(col => {
                colWidths.push({ wch: Math.max(col.length, 15) });
            });
            ws['!cols'] = colWidths;
        }

        // Criar workbook
        const wb = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(wb, ws, 'Contratos');

        console.log('[API] Workbook criado com sucesso');

        // Gerar arquivo em buffer
        const buffer = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });

        console.log('[API] Buffer gerado, tamanho:', buffer.length, 'bytes');

        // Enviar arquivo
        const dataAtual = new Date().toISOString().split('T')[0];
        const nomeArquivo = `contratos_${dataAtual}_${Date.now()}.xlsx`;

        // Salvar arquivo no histórico
        const caminhoHistorico = path.join(historicoDir, nomeArquivo);
        fs.writeFileSync(caminhoHistorico, buffer);
        console.log('[API] Arquivo salvo no histórico:', caminhoHistorico);

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
        res.send(buffer);

        console.log('[API] Arquivo enviado:', nomeArquivo);

    } catch (erro) {
        console.error('[API] Erro ao exportar:', erro);
        console.error('[API] Stack:', erro.stack);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao gerar planilha: ' + (erro instanceof Error ? erro.message : String(erro))
        });
    }
});


// ============================================================
// ROTA: LIMPAR PASTA DE UPLOADS
// ============================================================

app.post('/api/limpar-uploads', (req, res) => {
    try {
        console.log('[API] Limpando pasta de uploads...');

        if (!fs.existsSync(uploadDir)) {
            return res.json({
                sucesso: true,
                mensagem: 'Pasta de uploads não encontrada'
            });
        }

        // Ler todos os arquivos da pasta
        const arquivos = fs.readdirSync(uploadDir);

        let deletados = 0;

        // Deletar cada arquivo
        arquivos.forEach(arquivo => {
            try {
                const caminhoCompleto = path.join(uploadDir, arquivo);
                
                // Verificar se é arquivo
                if (fs.statSync(caminhoCompleto).isFile()) {
                    fs.unlinkSync(caminhoCompleto);
                    deletados++;
                    console.log(`[API] Deletado: ${arquivo}`);
                }
            } catch (erro) {
                console.error(`[API] Erro ao deletar ${arquivo}:`, erro.message);
            }
        });

        console.log(`[API] Total de arquivos deletados: ${deletados}`);

        return res.json({
            sucesso: true,
            mensagem: `${deletados} arquivo(s) deletado(s)`,
            deletados: deletados
        });

    } catch (erro) {
        console.error('[API] Erro ao limpar uploads:', erro);
        return res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao limpar uploads: ' + erro.message
        });
    }
});


// ============================================================
// ROTA: LISTAR ARQUIVOS DO HISTÓRICO
// ============================================================

app.get('/api/historico', (req, res) => {
    try {
        if (!fs.existsSync(historicoDir)) {
            return res.json({
                sucesso: true,
                arquivos: []
            });
        }

        const arquivos = fs.readdirSync(historicoDir).map(arquivo => {
            const caminhoCompleto = path.join(historicoDir, arquivo);
            const stats = fs.statSync(caminhoCompleto);
            return {
                nome: arquivo,
                tamanho: stats.size,
                data: stats.mtime.toISOString(),
                dataFormatada: new Date(stats.mtime).toLocaleString('pt-BR')
            };
        }).sort((a, b) => new Date(b.data) - new Date(a.data));

        res.json({
            sucesso: true,
            arquivos: arquivos
        });
    } catch (erro) {
        console.error('[API] Erro ao listar histórico:', erro);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao listar histórico: ' + erro.message
        });
    }
});


// ============================================================
// ROTA: DOWNLOAD DO HISTÓRICO
// ============================================================

app.get('/api/historico/download/:arquivo', (req, res) => {
    try {
        const { arquivo } = req.params;
        
        // Validar nome do arquivo para evitar path traversal
        if (arquivo.includes('..') || arquivo.includes('/') || arquivo.includes('\\')) {
            return res.status(400).json({
                sucesso: false,
                mensagem: 'Nome de arquivo inválido'
            });
        }

        const caminhoArquivo = path.join(historicoDir, arquivo);

        // Verificar se arquivo existe
        if (!fs.existsSync(caminhoArquivo)) {
            return res.status(404).json({
                sucesso: false,
                mensagem: 'Arquivo não encontrado'
            });
        }

        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename="${arquivo}"`);
        
        const fileStream = fs.createReadStream(caminhoArquivo);
        fileStream.pipe(res);

        console.log('[API] Download de histórico:', arquivo);
    } catch (erro) {
        console.error('[API] Erro ao fazer download:', erro);
        res.status(500).json({
            sucesso: false,
            mensagem: 'Erro ao fazer download: ' + erro.message
        });
    }
});


// ============================================================
// ROTA: HEALTH CHECK
// ============================================================

app.get('/api/health', (req, res) => {
    res.json({ status: 'OK' });
});


// ============================================================
// INICIAR SERVIDOR
// ============================================================

app.listen(PORT, () => {
    console.log(`================================`);
    console.log(`Servidor iniciado na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
    console.log(`================================`);
});
