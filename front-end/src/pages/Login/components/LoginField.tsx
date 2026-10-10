import { LockKeyhole, Mail } from '../../../components/icons'

type LoginFieldProps = {
  id: string
  label: string
  placeholder: string
  type: 'email' | 'password'
  value: string
  autoComplete: string
  onChange: (value: string) => void
}

export function LoginField({ id, label, placeholder, type, value, autoComplete, onChange }: LoginFieldProps) {
  return (
    <>
      <label className={`mb-2 block text-[15px] font-bold text-[#333832] ${type === 'password' ? 'mt-3.5' : ''}`} htmlFor={id}>{label}</label>
      <div className="flex h-14 items-center gap-3 rounded-[11px] border border-[#e0e5dd] bg-white px-3.75 text-[#899287] transition focus-within:border-[#398444] focus-within:shadow-[0_0_0_3px_rgba(57,132,68,0.1)]">
        {type === 'email' ? <Mail className="h-5 w-5 shrink-0" strokeWidth={1.7} /> : <LockKeyhole className="h-5 w-5 shrink-0" strokeWidth={1.7} />}
        <input className="w-full min-w-0 border-0 bg-transparent text-[15px] text-text outline-none placeholder:text-[#899287]" id={id} type={type} placeholder={placeholder} autoComplete={autoComplete} value={value} onChange={(event) => onChange(event.target.value)} required />
      </div>
    </>
  )
}
