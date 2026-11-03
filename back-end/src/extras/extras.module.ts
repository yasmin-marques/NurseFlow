import { Module } from "@nestjs/common";
import { MongooseModule } from "@nestjs/mongoose";
import {
  AuditoriaExtra,
  AuditoriaExtraSchema,
  ExtraProgramado,
  ExtraProgramadoSchema,
} from "./extras.schema";
import { ExtrasService } from "./extras.service";

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: ExtraProgramado.name, schema: ExtraProgramadoSchema },
      { name: AuditoriaExtra.name, schema: AuditoriaExtraSchema },
    ]),
  ],
  providers: [ExtrasService],
  exports: [ExtrasService],
})
export class ExtrasModule {}
