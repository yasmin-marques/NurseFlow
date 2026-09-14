// Seleciona o banco
db = db.getSiblingDB("nurseflow");


// =====================================
// COLLECTION USUARIOS
// =====================================

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
                "tipo_usuario"
            ],

            properties: {

                nome:{
                    bsonType:"string"
                },

                email:{
                    bsonType:"string"
                },

                senha:{
                    bsonType:"string"
                },

                cpf:{
                    bsonType:"string"
                },

                telefone:{
                    bsonType:"string"
                },

                tipo_usuario:{
                    enum:[
                        "administrador",
                        "enfermeiro"
                    ]
                }
            }
        }
    }
});



// =====================================
// COLLECTION ADMINISTRADORES
// =====================================

db.createCollection("administradores", {

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[
                "usuario_id"
            ],

            properties:{

                usuario_id:{
                    bsonType:"objectId"
                },

            }

        }

    }

});



// =====================================
// COLLECTION ENFERMEIROS
// =====================================

db.createCollection("enfermeiros", {

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[

                "usuario_id",
                "registro_profissional",
                "tipo_vinculo",
                "status"

            ],

            properties:{


                usuario_id:{
                    bsonType:"objectId"
                },


                registro_profissional:{
                    bsonType:"string"
                },


                tipo_vinculo:{
                    bsonType:"string"
                },


                status:{
                    bsonType:"string"
                }

            }

        }

    }

});



// =====================================
// COLLECTION DISPONIBILIDADES
// =====================================

db.createCollection("disponibilidades",{

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[

                "enfermeiro_id",
                "dia_semana",
                "horario_inicio",
                "horario_fim"

            ],


            properties:{


                enfermeiro_id:{
                    bsonType:"objectId"
                },


                tipo_restricao:{
                    bsonType:"string"
                },


                dia_semana:{
                    bsonType:"string"
                },


                horario_inicio:{
                    bsonType:"string"
                },


                horario_fim:{
                    bsonType:"string"
                }

            }

        }

    }

});



// =====================================
// COLLECTION ESCALAS
// =====================================

db.createCollection("escalas",{

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[

                "administrador_id",
                "mes",
                "ano",
                "status"

            ],

            properties:{


                administrador_id:{
                    bsonType:"objectId"
                },


                mes:{
                    bsonType:"int"
                },


                ano:{
                    bsonType:"int"
                },


                status:{
                    enum:[
                        "rascunho",
                        "publicada",
                        "finalizada"
                    ]
                },


                data_criacao:{
                    bsonType:"date"
                }

            }

        }

    }

});



// =====================================
// COLLECTION PLANTOES
// =====================================

db.createCollection("plantoes",{

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[

                "escala_id",
                "enfermeiro_id",
                "setor_id",
                "data",
                "horario_inicio",
                "horario_fim"

            ],


            properties:{


                escala_id:{
                    bsonType:"objectId"
                },


                enfermeiro_id:{
                    bsonType:"objectId"
                },


                setor_id:{
                    bsonType:"objectId"
                },


                data:{
                    bsonType:"date"
                },


                horario_inicio:{
                    bsonType:"string"
                },


                horario_fim:{
                    bsonType:"string"
                },


                observacao:{
                    bsonType:"string"
                }

            }

        }

    }

});



// =====================================
// COLLECTION SETORES
// =====================================

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



// =====================================
// COLLECTION TROCAS DE PLANTAO
// =====================================

db.createCollection("trocas_plantao",{

    validator:{

        $jsonSchema:{

            bsonType:"object",

            required:[

                "plantao_id",
                "id_origem",
                "id_destino",
                "status"

            ],

            properties:{


                plantao_id:{
                    bsonType:"objectId"
                },


                id_origem:{
                    bsonType:"objectId"
                },


                id_destino:{
                    bsonType:"objectId"
                },


                data_solicitacao:{
                    bsonType:"date"
                },


                status:{
                    enum:[
                        "pendente",
                        "aceita_enf",
                        "recusada",
                        "aprovada_admin"
                    ]
                },


                aceita_enf:{
                    bsonType:"bool"
                },


                aprovada_admin:{
                    bsonType:"bool"
                }

            }

        }

    }

});




// =====================================
// ÍNDICES
// =====================================

db.usuarios.createIndex(
    {
        email:1
    },
    {
        unique:true
    }
);


db.enfermeiros.createIndex(
    {
        registro_profissional:1
    },
    {
        unique:true
    }
);