// BASELINE LEGADO: executado apenas no primeiro start do container (volume vazio).
// As migrations em back-end/migrations (npm run db:migrate) são a fonte da verdade e
// sobrescrevem estes validators (usuarios, profissionaisDaSaude, setores, configuracoes, restricoes).

// Seleciona o banco
db = db.getSiblingDB("nurseflow");

// COLLECTION USUARIOS
db.createCollection("usuarios", {

    validator: {

        $jsonSchema: {

            bsonType: "object",

            required: [
                "nome",
                "email",
                "senha",
                "cpf",
                "tipoUsuario"
            ],

            properties: {

                nome:{
                    bsonType:"string"
                },

                email:{
                    bsonType:"string",
                    pattern:"^.+@.+\\..+$"
                },

                senha:{
                    bsonType:"string"
                },

                cpf:{
                    bsonType:"string",
                    pattern:"^[0-9]{11}$"
                },

                telefone:{
                    bsonType:"string"
                },

                tipoUsuario:{
                    bsonType:"string",
                    enum:[
                        "administrador",
                        "profissionalDaSaude"
                    ]
                },

                senhaTemporaria:{
                    bsonType:"bool"
                },

                tentativasFalhasLogin:{
                    bsonType:"number",
                    minimum:0
                },

                bloqueadoAte:{
                    bsonType:["date","null"]
                },

                ultimoLoginEm:{
                    bsonType:["date","null"]
                },

                redefinicaoSenha:{
                    bsonType:["object","null"],
                    properties:{
                        tokenHash:{ bsonType:"string" },
                        expiraEm:{ bsonType:"date" }
                    }
                },

                createdAt:{
                    bsonType:"date"
                },

                updatedAt:{
                    bsonType:"date"
                }
            }
        }
    }
});


// COLLECTION ADMINISTRADORES
db.createCollection("administradores", {

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[
                "usuarioId"
            ],

            properties:{

                usuarioId:{
                    bsonType:"objectId"
                },

            }

        }

    }

});


// COLLECTION PROFISSIONAISDASAUDE
db.createCollection("profissionaisDaSaude", {

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[

                "usuarioId",
                "coren",
                "tipoVinculo",
                "status",
                "formacao",
                "sincronizaAgenda"

            ],

            properties:{


                usuarioId:{
                    bsonType:"objectId"
                },

                coren:{
                    bsonType:"string"
                },

                status:{
                    bsonType:"string",
                    enum:[
                        "ativo",
                        "desativado",
                        "afastado",
                        "ferias"
                    ]
                },

                tipoVinculo:{
                    bsonType:"string",
                    enum:[
                        "concursado",
                        "clt",
                        "rpa"
                    ]
                },

                formacao:{
                    bsonType:"string",
                    enum:[
                        "tecnico",
                        "enfermeiro"
                    ]
                },

                sincronizaAgenda:{
                    bsonType:"bool"
                },

                desativadoEm:{
                    bsonType:["date","null"]
                },

                createdAt:{
                    bsonType:"date"
                },

                updatedAt:{
                    bsonType:"date"
                }

            }

        }

    }

});

db.createCollection("ferias",{
    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[
                "profissionalId",
                "inicioFerias",
                "fimFerias"
            ],

            properties:{

                profissionalId:{
                    bsonType:"objectId"
                },

                inicioFerias:{
                    bsonType:"date"
                },

                fimFerias:{
                    bsonType:"date"
                }
                
            }
        }
    }
});


// COLLECTION RESTRIÇÕES
db.createCollection("restricoes",{

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[
                "profissionalId",
                "administradorCriadorId",
                "diaSemana",
                "horarioInicio",
                "horarioFim"

            ],


            properties:{


                profissionalId:{
                    bsonType:"objectId"
                },

                administradorCriadorId:{
                    bsonType:"objectId"
                },


                tipoRestricao:{
                    bsonType:"string"
                },


                diaSemana:{
                    bsonType:"string"
                },


                horarioInicio:{
                    bsonType:"string"
                },


                horarioFim:{
                    bsonType:"string"
                }

            }

        }

    }

});

db.createCollection("configuracoes",{
    validator:{

        $jsonSchema:{

            bsonType: "object",

            required:[
                "administradorId",
                "quantMaxExtra",
                "quantMaxTroca",
                "quantLimitePlantao"
            ],

            properties:{

                administradorId:{
                    bsonType:"objectId"
                },

                quantMaxExtra:{
                    bsonType:"int"
                },

                quantMaxTroca:{
                    bsonType:"int"
                },

                quantLimitePlantao:{
                    bsonType:"int"
                }
                
            }
        }
    }
});


// COLLECTION ESCALAS
db.createCollection("escalas",{

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[

                "administradorId",
                "mes",
                "ano",
                "status"

            ],

            properties:{


                administradorId:{   
                    bsonType:"objectId"
                },


                mes:{
                    bsonType:"int",
                    minimum:1,
                    maximum:12
                },


                ano:{
                    bsonType:"int",
                    minimum:2020
                },


                status:{
                    bsonType:"string",
                    enum:[
                        "rascunho",
                        "publicada",
                        "finalizada"
                    ]
                },


                dataCriacao:{
                    bsonType:"date"
                }

            }

        }

    }

});


db.createCollection("profissionaisRelacionados",{
    validator:{

        $jsonSchema:{
            bsonType:"object",

            required:[
                "plantaoId",
                "profissionalID"
            ],

            properties:{
                
                plantaoId:{
                    bsonType: "objectId"
                },

                profissionalId:{
                    bsonType: "objectId"
                }
            }
        }
    }
});

db.createCollection("notificacoes",{
    validator:{

        $jsonSchema:{
            bsonType:"object",

            required:[
                "lida",
                "dataEnvio",
                "mensagem"
            ],

            properties:{

                lida:{
                    bsonType:"bool"
                },

                dataEnvio:{
                    bsonType:"date"
                },

                mensagem:{
                    bsonType:"string"
                }
            }
        }
    }
})

// COLLECTION PLANTOES
db.createCollection("plantoes",{

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[
                "escalaId",
                "setorId",
                "data",
                "horarioInicio",
                "horarioFim",
                "tipo"

            ],


            properties:{


                escalaId:{
                    bsonType:"objectId"
                },


                setorId:{
                    bsonType:"objectId"
                },


                data:{
                    bsonType:"date"
                },


                horarioInicio:{
                    bsonType:"string"
                },


                horarioFim:{
                    bsonType:"string"
                },

                tipo:{
                    bsonType:"string",
                    enum:[
                        "regular",
                        "extra"
                    ]
                }

            }

        }

    }

});


// COLLECTION SETORES
// Quantitativo mínimo por turno (diurno/noturno) e função (DA07/DA08)
db.createCollection("setores",{

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[
                "nome",
                "turnos",
                "ativo"
            ],

            properties:{

                nome:{
                    bsonType:"string"
                },

                descricao:{
                    bsonType:"string"
                },

                ativo:{
                    bsonType:"bool"
                },

                turnos:{
                    bsonType:"object",
                    required:["diurno","noturno"],
                    properties:{
                        diurno:{
                            bsonType:"object",
                            required:["enfermeiros","tecnicos"],
                            properties:{
                                enfermeiros:{ bsonType:"number", minimum:0 },
                                tecnicos:{ bsonType:"number", minimum:0 }
                            }
                        },
                        noturno:{
                            bsonType:"object",
                            required:["enfermeiros","tecnicos"],
                            properties:{
                                enfermeiros:{ bsonType:"number", minimum:0 },
                                tecnicos:{ bsonType:"number", minimum:0 }
                            }
                        }
                    }
                },

                createdAt:{
                    bsonType:"date"
                },

                updatedAt:{
                    bsonType:"date"
                }

            }

        }

    }

});


// COLLECTION TROCAS DE PLANTAO
db.createCollection("trocasPlantao",{

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[
                "plantaoId",
                "profissionalOrigemId",
                "profissionalDestinoId",
                "status"

            ],

            properties:{


                plantaoId:{
                    bsonType:"objectId"
                },

                profissionalOrigemId:{
                    bsonType:"objectId"
                },


                profissionalDestinoId:{
                    bsonType:"objectId"
                },


                dataSolicitacao:{
                    bsonType:"date"
                },


                status:{
                    bsonType:"string",
                    enum:[
                        "pendente",
                        "aceitaEnf",
                        "recusada",
                        "aprovadaAdmin"
                    ]
                }

            }

        }

    }

});

//INDICES

// USUARIOS
db.usuarios.createIndex(
{
    email:1
},
{
    unique:true
});

db.usuarios.createIndex(
{
    cpf:1
},
{
    unique:true
});


// PROFISSIONAIS
db.profissionaisDaSaude.createIndex(
{
    coren:1
},
{
    unique:true
});

db.profissionaisDaSaude.createIndex(
{
    usuarioId:1
},
{
    unique:true
});

db.profissionaisDaSaude.createIndex(
{
    status:1
});


// ADMINISTRADORES
db.administradores.createIndex(
{
    usuarioId:1
},
{
    unique:true
});


// SETORES
db.setores.createIndex(
{
    nome:1
},
{
    unique:true,
    collation:{ locale:"pt", strength:1 }
});


// ESCALAS
db.escalas.createIndex(
{
    administradorId:1
});

db.escalas.createIndex(
{
    status:1
});

db.escalas.createIndex(
{
    mes:1,
    ano:1
});

// PLANTOES

db.plantoes.createIndex(
{
    escalaId:1
});


db.plantoes.createIndex(
{
    setorId:1
});


db.plantoes.createIndex(
{
    data:1
});


db.plantoes.createIndex(
{
    tipo:1
});


// PROFISSIONAIS RELACIONADOS
db.profissionaisRelacionados.createIndex(
{
    plantaoId:1
});

db.profissionaisRelacionados.createIndex(
{
    profissionalId:1
});

db.profissionaisRelacionados.createIndex(
{
    plantaoId:1,
    profissionalId:1
},
{
    unique:true
});


// TROCAS
db.trocasPlantao.createIndex(
{
    status:1
});

db.trocasPlantao.createIndex(
{
    plantaoId:1
});

db.trocasPlantao.createIndex(
{
    profissionalOrigemId:1
});

db.trocasPlantao.createIndex(
{
    profissionalDestinoId:1
});


// NOTIFICACOES
db.notificacoes.createIndex(
{
    profissionalId:1
});

db.notificacoes.createIndex(
{
    lida:1
});


db.ferias.createIndex(
{
    profissionalId:1
});


db.restricoes.createIndex(
{
    profissionalId:1
});


db.configuracoes.createIndex(
{
    administradorId:1
});