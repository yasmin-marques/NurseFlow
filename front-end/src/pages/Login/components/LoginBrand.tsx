import backgroundLogin from '../../../assets/backgroundLogin.png'
import logo from '../../../assets/logo.png'

export function LoginBrand() {
  return (
    <section
      className="flex min-h-0 items-center justify-center bg-[#064b2c] bg-cover bg-position-[center_40%] md:min-h-screen md:bg-center"
      style={{ backgroundImage: `url(${backgroundLogin})` }}
      aria-label="NurseFlow — escalas que cuidam"
    >
      <div className="flex flex-col items-center gap-2 text-xs font-medium tracking-[0.015em] text-white md:gap-5 md:text-[16px]">
        <img src={logo} alt="" className="w-24 md:w-[clamp(130px,19vw,230px)]" />
        <span>ESCALAS QUE CUIDAM</span>
      </div>
    </section>
  )
}
