export type FormationType = 'Enfemeiro' | 'Técnico'
export type bondType = 'CLT' | 'RPA' | 'Concursado'
export type ProfessionalStatus = 'ativo' | 'desativado' | 'afastado' | 'ferias'

export type Professional = {
    id?: string,
    apiStatus?: ProfessionalStatus,
    createdAt?: string,
    updatedAt?: string,
    name: string,
    cpf: string
    email: string,
    coren: string,
    bond: bondType,
    status: boolean,
    formation: FormationType,
}