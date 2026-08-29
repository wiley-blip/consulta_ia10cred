// ```javascript
// const BASE_URL = "https://webservice-homol.facta.com.br";
// // Produção:
// // const BASE_URL = "https://webservice.facta.com.br";
// ```

// * `cpf`
// * `tipo_operacao` = `14` ou `49`
// * `averbador` = `3`
// * `convenio` = `3`
// * Header `Authorization: Bearer TOKEN`


async function consultarContratosRefinanciamento({
    token,
    cpf,
    tipo_operacao = 14
}) {
    const BASE_URL = process.env.FACTA_URL;
    const url = new URL(
        `${BASE_URL}/proposta/contratos-refinanciamento`
    );

    url.searchParams.append("cpf", cpf);
    url.searchParams.append("tipo_operacao", tipo_operacao);
    url.searchParams.append("averbador", "3");
    url.searchParams.append("convenio", "3");

    console.log("Consultando contratos...");
    console.log("URL:", url.toString());
    console.log(    "Token:", token);

    // const response = await fetch(url, {
    //     method: "GET",
    //     headers: {
    //         "Authorization": `Bearer ${token}`,
    //         "Accept": "application/json"
    //     }
    // });

    const response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        headers: {
            "Authorization": `Bearer ${token}`,
            "Accept": "application/json"
        }
    });

    const texto = await response.text();

    console.log("HTTP:", response.status);
    console.log("Resposta:", texto);

    let data;

    try {
        data = JSON.parse(texto);
    } catch {
        return {
            sucesso: false,
            status: response.status,
            mensagem: `FACTA retornou resposta que não é JSON: ${texto}`
        };
    }

    if (!response.ok) {
        return {
            sucesso: false,
            status: response.status,
            mensagem: `Erro HTTP ${response.status}: ${data.mensagem || texto}`
        };
    }

    if (data.erro) {
        return {
            sucesso: false,
            status: response.status,
            mensagem: data.mensagem || "Erro ao consultar contratos."
        };
    }

    return {
        sucesso: true,
        status: response.status,
        dados: data
    };
}

// Exemplo de uso

// ```javascript
// const contratos = await consultarContratosRefinanciamento({
//     token,
//     cpf: "00000000000",
//     tipo_operacao: 14
// });

// console.log("Contratos encontrados:");
// console.log(
//     JSON.stringify(contratos, null, 2)
// );
// ```


// ============================================================
// EXPORTAR FUNÇÕES
// ============================================================

module.exports = {
  consultarContratosRefinanciamento
};