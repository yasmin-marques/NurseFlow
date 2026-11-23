const { replaceIndex } = require('./lib');

module.exports = {
  async up(db) {
    await replaceIndex(db, 'plantoes', 'escalaId_1_data_1_horarioInicio_1', { escalaId: 1, data: 1, horarioInicio: 1 }, {});
    await replaceIndex(db, 'plantoes', 'data_1_setorId_1_horarioInicio_1', { data: 1, setorId: 1, horarioInicio: 1 }, {});
    await replaceIndex(db, 'profissionaisRelacionados', 'profissionalId_1_plantaoId_1', { profissionalId: 1, plantaoId: 1 }, {});
    await replaceIndex(db, 'profissionaisDaSaude', 'formacao_1_status_1', { formacao: 1, status: 1 }, {});
    await replaceIndex(db, 'restricoes', 'profissionalId_1_inicio_1_fim_1', { profissionalId: 1, inicio: 1, fim: 1 }, {});
  },

  async down(db) {
    // Os índices são auxiliares de leitura; o rollback não altera dados nem regras.
  },
};
