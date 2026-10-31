import { IsString, IsNumber, Min, IsDefined, IsOptional, MaxLength } from 'class-validator';

export class CriarSolicitacaoDto {
  @IsString({ message: 'O centroCustoId deve ser uma string.' })
  @IsDefined({ message: 'O centroCustoId é obrigatório.' })
  centroCustoId: string;

  @IsNumber({ maxDecimalPlaces: 2 }, { message: 'O valor deve ter no máximo duas casas decimais.' })
  @Min(0.01, { message: 'O valor deve ser maior que zero.' })
  @IsDefined({ message: 'O valor é obrigatório.' })
  valor: number;

  @IsString({ message: 'A categoria deve ser uma string.' })
  @IsDefined({ message: 'A categoria é obrigatória (CA-02.1).' })
  categoria: string;

  @IsString({ message: 'A justificativa deve ser uma string.' })
  @IsOptional()
  justificativa?: string;
  
  @IsString()
  @IsOptional()
  fornecedor?: string;
}