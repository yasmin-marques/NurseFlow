"""Contrato HTTP do otimizador. O NestJS monta o problema; este serviço apenas resolve."""
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Formacao = Literal["enfermeiro", "tecnico"]
Opcao = Literal["24h", "12d", "12n"]
Turno = Literal["diurno", "noturno"]
Funcao = Literal["enfermeiros", "tecnicos"]


class Quantitativo(BaseModel):
    enfermeiros: int = Field(ge=0)
    tecnicos: int = Field(ge=0)


class TurnosSetor(BaseModel):
    diurno: Quantitativo
    noturno: Quantitativo


class Setor(BaseModel):
    id: str
    nome: str = ""
    turnos: TurnosSetor


class Profissional(BaseModel):
    id: str
    formacao: Formacao
    vinculo: str = ""
    # Carga regular esperada no mês (vinda das configurações). O que exceder vira "extra".
    carga_24h: int = Field(default=0, ge=0)
    carga_12h: int = Field(default=0, ge=0)
    # Máximo de plantões extras no mês (além da carga regular).
    max_extras: int = Field(default=0, ge=0)
    # Teto de plantões totais no mês; 0 = sem teto.
    max_plantoes: int = Field(default=0, ge=0)
    # Dias do mês (1-based) em que o profissional NÃO pode iniciar um plantão.
    dias_bloqueados: list[int] = Field(default_factory=list)
    # Horas, contadas a partir de 00:00 do dia 1, antes das quais o profissional não pode
    # iniciar plantão (descanso herdado do mês anterior). Valor <= 0 significa "livre".
    livre_a_partir_horas: int = 0


class Parametros(BaseModel):
    tempo_limite_segundos: float = Field(default=30, gt=0, le=600)
    descanso_apos_24h: int = Field(default=72, ge=0)  # regime 24x72
    descanso_apos_12h: int = Field(default=36, ge=0)  # regime 12x36
    semente: int = 42


class Problema(BaseModel):
    ano: int = Field(ge=2000)
    mes: int = Field(ge=1, le=12)
    dias_mes: int = Field(ge=28, le=31)
    profissionais: list[Profissional]
    setores: list[Setor]
    parametros: Parametros = Field(default_factory=Parametros)

    @field_validator("profissionais")
    @classmethod
    def _ids_unicos_prof(cls, v: list[Profissional]) -> list[Profissional]:
        if len({p.id for p in v}) != len(v):
            raise ValueError("ids de profissionais duplicados")
        return v

    @field_validator("setores")
    @classmethod
    def _ids_unicos_setor(cls, v: list[Setor]) -> list[Setor]:
        if len({s.id for s in v}) != len(v):
            raise ValueError("ids de setores duplicados")
        return v

    @model_validator(mode="after")
    def _dias_validos(self) -> "Problema":
        for p in self.profissionais:
            if any(d < 1 or d > self.dias_mes for d in p.dias_bloqueados):
                raise ValueError(f"dias_bloqueados fora do mês para o profissional {p.id}")
        return self


class Alocacao(BaseModel):
    profissional_id: str
    setor_id: str
    dia: int  # 1-based
    opcao: Opcao
    extra: bool


class Descoberto(BaseModel):
    setor_id: str
    dia: int
    turno: Turno
    funcao: Funcao
    necessario: int
    alocado: int
    faltam: int


class CargaProfissional(BaseModel):
    profissional_id: str
    plantoes_24h: int
    plantoes_12h: int
    extras: int
    faltam_24h: int
    faltam_12h: int


class Estatisticas(BaseModel):
    status: str
    otimo: bool
    objetivo: float | None
    melhor_limite: float | None
    tempo_segundos: float
    total_alocacoes: int
    total_descobertos: int
    cargas: list[CargaProfissional]


class Solucao(BaseModel):
    alocacoes: list[Alocacao]
    descobertos: list[Descoberto]
    estatisticas: Estatisticas
