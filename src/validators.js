function validarEmail(email) {
  const re = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
  return typeof email === 'string' && re.test(email.toLowerCase());
}

function validarComplexidadeSenha(senha) {
  const re = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#._-])[A-Za-z\d@$!%*?&#._-]{8,}$/;
  return typeof senha === 'string' && re.test(senha);
}

module.exports = { validarEmail, validarComplexidadeSenha };
