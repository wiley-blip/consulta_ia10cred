const { token_request } = require('./autenticacao.js');
const { consultarContratosRefinanciamento } = require('./consultarContratosRefinanciamento.js');

async function main() {
    const TOKEN = await token_request();

    const consulta = await consultarContratosRefinanciamento({
        token: TOKEN,
        cpf: "12865592863",
        // cpf: "07980186583",
        tipo_operacao: 14
    });

    console.log('[DEBUG] Consulta de contratos de refinanciamento:');
    console.log(consulta)
}

main()