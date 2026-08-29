
// ============================================================
// CARREGAR VARIÁVEIS DE AMBIENTE
// ============================================================

require('dotenv').config();


// ============================================================
// FORÇAR RESOLUÇÃO DNS PARA IPV4
// ============================================================

const dns = require("dns");

dns.setDefaultResultOrder("ipv4first");


// ============================================================
// GERAR BASE64
// ============================================================

function gerarBase64(user, senha) {
  const userSenha = user + ":" + senha;
  return Buffer
    .from(userSenha, "utf8")
    .toString("base64");
}


// ============================================================
// DESCOBRIR IPV4 PÚBLICO
// ============================================================

async function obterIPv4Publico() {
  const response = await fetch("https://api.ipify.org?format=json");

  if (!response.ok) {
    throw new Error(
      "Não foi possível descobrir o IPv4 público. HTTP " +
      response.status
    );
  }

  const dados = await response.json();

  return dados.ip;
}


// ============================================================
// AUTENTICAR NA FACTA
// ============================================================

async function autenticarFacta(token) {

  const URL = `${process.env.FACTA_URL}/gera-token`;

  const response = await fetch(URL, {
    method: "GET",

    headers: {
      "Authorization": "Basic " + token,
      "Accept": "application/json"
    }
  });

  const status = response.status;
  const textoResposta = await response.text();

  let dados;

  try {
    dados = JSON.parse(textoResposta);

  } catch (erro) {

    return {
      sucesso: false,
      status: status,
      token: "",
      mensagem:
        "Resposta inválida da API: " +
        textoResposta
    };
  }


  if (
    status < 200 ||
    status >= 300 ||
    dados.erro === true
  ) {

    return {
      sucesso: false,
      status: status,
      token: "",
      mensagem:
        dados.mensagem ||
        "Falha na autenticação."
    };
  }


  return {
    sucesso: true,
    status: status,
    token: dados.token || "",
    mensagem:
      dados.mensagem ||
      "Autenticação realizada com sucesso."
  };
}


// ============================================================
// MAIN
// ============================================================

async function token_request() {

  const USERNAME = process.env.USER;
  const SENHA = process.env.SENHA;

  try {

    // --------------------------------------------------------
    // Verifica o IPv4 público utilizado pela máquina
    // --------------------------------------------------------

    const ipv4 = await obterIPv4Publico();

    console.log("----------------------------------------");
    console.log("IPv4 público: " + ipv4);
    console.log("----------------------------------------");


    // --------------------------------------------------------
    // Gera Base64
    // --------------------------------------------------------

    const TOKEN = gerarBase64(
      USERNAME,
      SENHA
    );

    console.log(
      "Base64 gerado: " + TOKEN
    );


    // --------------------------------------------------------
    // Autenticação
    // --------------------------------------------------------

    const resultado =
      await autenticarFacta(TOKEN);


    console.log(
      "Status HTTP: " +
      resultado.status
    );

    console.log(
      "Sucesso: " +
      resultado.sucesso
    );

    console.log(
      "Mensagem: " +
      resultado.mensagem
    );


    if (resultado.sucesso) {

      console.log(
        "Token Facta: " +
        resultado.token
      );

      return resultado.token;
    }


  } catch (erro) {

    console.log(
      "Erro ao autenticar na Facta:"
    );

    console.log(
      erro instanceof Error
        ? erro.message
        : String(erro)
    );
  }
}


// ============================================================
// EXPORTAR FUNÇÕES
// ============================================================

module.exports = {
  token_request
};

