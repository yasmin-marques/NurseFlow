export type FormationType = 'Enfemeiro' | 'Técnico'
export type bondType = 'CLT' | 'RPA' | 'Concursado'

export type Professional = {
    name: string,
    cpf: string
    email: string,
    coren: string,
    bond: bondType,
    status: boolean,
    formation: FormationType,
}