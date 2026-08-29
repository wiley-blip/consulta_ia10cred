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

// Garantir que a pasta existe
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
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

app.use(express.json());
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
