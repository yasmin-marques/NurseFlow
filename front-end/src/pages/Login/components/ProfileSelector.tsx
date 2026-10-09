import { Building2, Check, Users } from '../../../components/icons'
import type { LoginProfile, ProfileOption } from '../types'

const profiles: ProfileOption[] = [
  { id: 'coordenação', title: 'Coordenação', description: 'Gerenciar equipe e escalas', building: true },
  { id: 'enfermeiro', title: 'Enfermeiro', description: 'Consultar plantões e trocas' },
  { id: 'técnico', title: 'Técnico', description: 'Ver escala, setor e equipe' },
]

type ProfileSelectorProps = {
  value: LoginProfile
  onChange: (profile: LoginProfile) => void
}

export function ProfileSelector({ value, onChange }: ProfileSelectorProps) {
  return (
    <fieldset className="mb-5.5 mt-5.5 min-w-0 border-0 p-0 md:mb-5.5 md:mt-12">
      <legend className="mb-2.5 text-[12px] font-bold tracking-[0.08em] text-[#727970]">QUAL É O SEU PERFIL?</legend>
      <div className="grid grid-cols-3 gap-1.5 min-[421px]:gap-2.5">
        {profiles.map((item) => {
          const selected = value === item.id
          return (
            <button key={item.id} type="button" className={`flex min-h-18 min-w-0 items-center gap-1.5 rounded-xl border px-1.5 py-6 text-left text-text transition min-[421px]:gap-2 min-[421px]:px-2.5 md:min-h-20.5 ${selected ? 'border-[#32823d] bg-[#f5f9f2] shadow-[0_0_0_1px_rgba(50,130,61,0.08)]' : 'border-[#e2e7df] bg-white hover:border-[#86b88a]'}`} aria-pressed={selected} onClick={() => onChange(item.id)}>
              <span className="grid h-7 w-7 flex-none place-items-center rounded-lg bg-[#e7f2e1] text-primary min-[421px]:h-8.5 min-[421px]:w-8.5">{item.building ? <Building2 className="h-5 w-5" strokeWidth={1.7} /> : <Users className="h-5 w-5" strokeWidth={1.7} />}</span>
              <span className="flex min-w-0 flex-1 flex-col gap-0.75"><strong className="text-[14px] font-bold leading-tight min-[421px]:text-[px]">{item.title}</strong><small className="text-[9px] leading-[1.35] text-[#777e75] min-[421px]:text-[10px]">{item.description}</small></span>
              <span className={`grid h-4 w-4 flex-none place-items-center rounded-full border min-[421px]:h-4.5 min-[421px]:w-4.5 ${selected ? 'border-primary bg-primary text-white' : 'border-[#dce2da] bg-white'}`} aria-hidden="true">{selected && <Check className="h-3 w-3" strokeWidth={3.5} />}</span>
            </button>
          )
        })}
      </div>
    </fieldset>
  )
}
