import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { CreateLeadDto } from '../dto/create-lead.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { LeadEntity } from '../entities/lead.entity';
import { DeepPartial, Repository } from 'typeorm';
import { LeadExceptionEnum } from '../exceptions/lead.exceptions';
import { LeadDataDto } from '../dto/lead-data.dto';
import { ExceptionConstants } from '~/common-util/exceptions-constants';
import { GetLeadDto } from '../dto/get-lead.dto';

@Injectable()
export class LeadService {
  constructor(
    @InjectRepository(LeadEntity)
    private leadRepository: Repository<LeadEntity>,
  ) {}

  private readonly logger = new Logger(LeadService.name);

  async findAll(): Promise<LeadEntity[]> {
    return this.leadRepository.find();
  }

  async findById(id: string): Promise<LeadEntity> {
    const lead = await this.leadRepository.findOneBy({ id });
    if (!lead) {
      this.logger.warn('Lead not found');
      throw new NotFoundException(LeadExceptionEnum.LEAD_NOT_FOUND);
    }
    return lead;
  }

  async create(createLeadDto: Partial<CreateLeadDto>): Promise<LeadEntity> {
    await this.validateIfEmailIsTaken(createLeadDto.email);

    const leadEntity = this.leadRepository.create({
      data: createLeadDto,
    });
    this.logger.log('Creating lead -> ' + JSON.stringify(leadEntity));

    return await this.leadRepository.save(leadEntity);
  }

  async validateIfEmailIsTaken(email: string): Promise<void> {
    const result = await this.leadRepository.query(`
      SELECT COUNT(*)
      FROM leads
      WHERE data ->> 'email' = '${email}'
      AND deleteddate IS NULL
      LIMIT 1;
    `);
    if (result[0].count > 0) {
      this.logger.warn('Email is taken -> ' + email);
      throw new BadRequestException(LeadExceptionEnum.LEAD_EMAIL_ALREADY_EXIST);
    }
  }

  async updateLeadDataJson(
    id: string,
    leadDataDto: LeadDataDto,
  ): Promise<GetLeadDto> {
    this.validateFieldsSize(leadDataDto);

    let leadEntity = await this.findById(id);
    leadEntity = this.mergeCurrentDataWithNewData(leadDataDto, leadEntity);

    return await this.leadRepository.save(leadEntity);
  }

  private validateFieldsSize(leadDataDto: LeadDataDto): void {
    if (Object.keys(leadDataDto).length === 0) {
      this.logger.warn('No fields to update');
      throw new BadRequestException(ExceptionConstants.NO_FIELDS_TO_UPDATE);
    }
  }

  private mergeCurrentDataWithNewData(
    leadDataDto: LeadDataDto,
    leadEntity: LeadEntity,
  ): LeadEntity {
    this.logger.debug('Current info -> ' + JSON.stringify(leadEntity.data));
    this.logger.debug('Info to update -> ' + JSON.stringify(leadDataDto));

    leadEntity.data = {
      ...leadDataDto,
      ...leadEntity.data,
    };
    this.logger.debug('Data after merge -> ' + JSON.stringify(leadEntity.data));

    return leadEntity;
  }
}
