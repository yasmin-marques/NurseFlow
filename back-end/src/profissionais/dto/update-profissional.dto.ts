import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateProfissionalDto } from './create-profissional.dto';

/** Edição parcial (DA03). A senha não é alterada por aqui. */
export class UpdateProfissionalDto extends PartialType(OmitType(CreateProfissionalDto, ['senha'] as const)) {}
