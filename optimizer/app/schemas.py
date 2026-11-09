"""Contrato HTTP do otimizador. O NestJS monta o problema; este serviço apenas resolve."""
from typing import Literal

from pydantic import BaseModel, Field, field_validator, model_validator

Formacao = Literal["enfermeiro", "tecnico"]
Opcao = Literal["24h", "12d", "12n"]
Turno = Literal["diurno", "noturno"]
Funcao = Literal["enfermeiros", "tecnicos"]
CAPACIDADE_ALOCACOES_FIXAS = "alocacoes_fixas"
VERSAO_CONTRATO = 2


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


class TurnoBloqueado(BaseModel):
    dia: int = Field(ge=1)
    turno: Turno


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
    # Turnos específicos bloqueados em determinados dias do mês.
    turnos_bloqueados: list[TurnoBloqueado] = Field(default_factory=list)
    # Horas, contadas a partir de 00:00 do dia 1, antes das quais o profissional não pode
    # iniciar plantão (descanso herdado do mês anterior). Valor <= 0 significa "livre".
    livre_a_partir_horas: int = 0


class Parametros(BaseModel):
    tempo_limite_segundos: float = Field(default=30, gt=0, le=600)
    descanso_apos_24h: int = Field(default=72, ge=0)  # regime 24x72
    descanso_apos_12h: int = Field(default=36, ge=0)  # regime 12x36
    semente: int = 42


class Problema(BaseModel):
    versao_contrato: Literal[VERSAO_CONTRATO]
    capacidades: list[Literal[CAPACIDADE_ALOCACOES_FIXAS]] = Field(min_length=1)
    operacao_id: str | None = None
    ano: int = Field(ge=1, le=9999)
    mes: int = Field(ge=1, le=12)
    dias_mes: int = Field(ge=28, le=31)
    profissionais: list[Profissional]
    setores: list[Setor]
    turnos_selecionados: list[Turno] = Field(default_factory=lambda: ["diurno", "noturno"], min_length=1)
    parametros: Parametros = Field(default_factory=Parametros)
    alocacoes_fixas: list["AlocacaoFixa"] = Field(default_factory=list)

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
        ids_profissionais = {p.id for p in self.profissionais}
        ids_setores = {s.id for s in self.setores}
        ids_extras = [a.extra_id for a in self.alocacoes_fixas]
        if len(set(ids_extras)) != len(ids_extras):
            raise ValueError("extra_id duplicado em alocacoes_fixas")
        for alocacao in self.alocacoes_fixas:
            if alocacao.dia > self.dias_mes:
                raise ValueError(f"dia de alocacao_fixa fora do mês: {alocacao.dia}")
            if alocacao.profissional_id not in ids_profissionais:
                raise ValueError(f"profissional inexistente em alocacao_fixa: {alocacao.profissional_id}")
            if alocacao.setor_id not in ids_setores:
                raise ValueError(f"setor inexistente em alocacao_fixa: {alocacao.setor_id}")
        for p in self.profissionais:
            if any(d < 1 or d > self.dias_mes for d in p.dias_bloqueados):
                raise ValueError(f"dias_bloqueados fora do mês para o profissional {p.id}")
            if any(tb.dia < 1 or tb.dia > self.dias_mes for tb in p.turnos_bloqueados):
                raise ValueError(f"turnos_bloqueados fora do mês para o profissional {p.id}")
        return self

    @field_validator("capacidades")
    @classmethod
    def _capacidade_obrigatoria(cls, v: list[str]) -> list[str]:
        if CAPACIDADE_ALOCACOES_FIXAS not in v:
            raise ValueError("o contrato não suporta alocacoes_fixas")
        return v


class AlocacaoFixa(BaseModel):
    extra_id: str = Field(min_length=1)
    profissional_id: str = Field(min_length=1)
    setor_id: str = Field(min_length=1)
    dia: int = Field(ge=1)
    opcao: Opcao
    tipo: Literal["extra"]


class Alocacao(BaseModel):
    profissional_id: str
    setor_id: str
    dia: int  # 1-based
    opcao: Opcao
    extra: bool
    extra_id: str | None = None


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
    versao_contrato: Literal[VERSAO_CONTRATO]
    capacidades: list[Literal[CAPACIDADE_ALOCACOES_FIXAS]] = Field(min_length=1)
    alocacoes: list[Alocacao]
    descobertos: list[Descoberto]
    estatisticas: Estatisticas

    @field_validator("capacidades")
    @classmethod
    def _capacidade_obrigatoria(cls, v: list[str]) -> list[str]:
        if CAPACIDADE_ALOCACOES_FIXAS not in v:
            raise ValueError("o contrato não suporta alocacoes_fixas")
        return v
