import { registerDecorator, type ValidationOptions } from 'class-validator';
import { cpfValido } from '../utils/cpf';

/** Valida CPF. Combine com um @Transform que mantenha apenas os dígitos. */
export function IsCpf(options?: ValidationOptions): PropertyDecorator {
  return (target, propertyKey) => {
    registerDecorator({
      name: 'isCpf',
      target: target.constructor,
      propertyName: propertyKey as string,
      options: { message: 'CPF inválido', ...options },
      validator: {
        validate: (value: unknown) => typeof value === 'string' && cpfValido(value),
      },
    });
  };
}
