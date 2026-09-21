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
                "telefone",
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
                        "enfermeiro"
                    ]
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


// COLLECTION ENFERMEIROS
db.createCollection("enfermeiros", {

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[

                "usuarioId",
                "coren",
                "tipoVinculo",
                "status"

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
                        "afastado",
                        "ferias",
                        "desligado"
                    ]
                },

                tipoVinculo:{
                    bsonType:"string",
                    enum:[
                        "concursado",
                        "clt",
                        "rpa"
                    ]
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

                "enfermeiroId",
                "administradorCriadorId",
                "diaSemana",
                "horarioInicio",
                "horarioFim"

            ],


            properties:{


                enfermeiroId:{
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


// COLLECTION PLANTOES
db.createCollection("plantoes",{

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[

                "escalaId",
                "enfermeiros",
                "setorId",
                "data",
                "horarioInicio",
                "horarioFim"

            ],


            properties:{


                escalaId:{
                    bsonType:"objectId"
                },


                enfermeiros:{
                    bsonType:"array",
                    minItems:1,
                    items:{
                        bsonType:"object",
                        required:[
                            "enfermeiroId"
                        ],
                        properties:{
                            enfermeiroId:{
                                bsonType:"objectId"
                            },

                            funcao:{
                                bsonType:"string",
                                enum:[
                                    "chefe",
                                    "apoio"
                                ]
                            }
                        }
                    }
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


                observacao:{
                    bsonType:"string"
                }

            }

        }

    }

});


// COLLECTION SETORES
db.createCollection("setores",{

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[
                "nome"
            ],

            properties:{

                nome:{
                    bsonType:"string"
                },

                descricao:{
                    bsonType:"string"
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
                "enfermeiroOrigemId",
                "enfermeiroDestinoId",
                "status"

            ],

            properties:{


                plantaoId:{
                    bsonType:"objectId"
                },

                enfermeiroOrigemId:{
                    bsonType:"objectId"
                },


                enfermeiroDestinoId:{
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



// ÍNDICES
db.usuarios.createIndex(
    {
        email:1
    },
    {
        unique:true
    }
);

db.usuarios.createIndex(
{
    cpf:1
},
{
    unique:true
}
);


db.enfermeiros.createIndex(
    {
        coren:1
    },
    {
        unique:true
    }
);

db.setores.createIndex(
{
    nome:1
},
{
    unique:true
}
);

db.administradores.createIndex(
{
    usuarioId:1
},
{
    unique:true
});


db.enfermeiros.createIndex(
{
    usuarioId:1
},
{
    unique:true
});


db.plantoes.createIndex(
{
    escalaId:1
});


db.trocasPlantao.createIndex(
{
    status:1
});