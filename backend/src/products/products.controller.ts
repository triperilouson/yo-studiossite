import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Public } from '../common/decorators/public.decorator';
import { ProductsService } from './products.service';

@Public()
@ApiTags('products')
@Controller('products')
export class ProductsController {
  constructor(private readonly products: ProductsService) {}
  @Get() @ApiOperation({ summary: 'List active products' })
  list(@Query('category') category?: string) { return this.products.list(category); }
  @Get(':slug') @ApiOperation({ summary: 'Get an active product by slug' })
  get(@Param('slug') slug: string) { return this.products.getBySlug(slug); }
}

