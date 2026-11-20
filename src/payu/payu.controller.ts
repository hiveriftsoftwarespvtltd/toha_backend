import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Req,
  Res,
  UseGuards,
  BadRequestException,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request, Response } from 'express';
import { PayuService } from './payu.service';
import { InitiatePayuDto } from './dto/initiate-payu.dto';
import { InitiateExpressPayuDto } from './dto/initiate-express-payu.dto';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { CurrentUser } from '../common/decorators/user.decorator';

@ApiTags('PayU Hosted & CommercePro Checkout')
@Controller('payu')
export class PayuController {
  constructor(private readonly payuService: PayuService) {}

  @Get('config')
  @ApiOperation({ summary: 'Check whether PayU Checkout is configured and active environment' })
  getConfig() {
    return this.payuService.getPublicConfig();
  }

  @Post('express/initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate PayU CommercePro 1-Click Express Checkout (bolt.launch v2Hash)' })
  async initiateExpress(@CurrentUser() user: any, @Body() body: InitiateExpressPayuDto) {
    const userId = user ? user._id.toString() : undefined;
    return this.payuService.initiateExpressCheckout(userId, body);
  }

  @Post('express/complete')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify & finalize PayU CommercePro responseHandler payload + save shipping address' })
  async completeExpress(@CurrentUser() user: any, @Body() body: Record<string, any>) {
    const userId = user ? user._id.toString() : undefined;
    return this.payuService.completeExpressCheckout(body, userId);
  }

  @Post('initiate')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate PayU Hosted Checkout payment for an existing order' })
  async initiate(@CurrentUser() user: any, @Body() body: InitiatePayuDto) {
    if (!body?.order_id) {
      throw new BadRequestException('order_id is required');
    }
    const userId = user ? user._id.toString() : undefined;
    return this.payuService.initiatePayment(body.order_id, userId, body.return_origin);
  }

  @Post('success')
  @ApiOperation({ summary: 'PayU sURL callback (application/x-www-form-urlencoded POST)' })
  async handleSuccessPost(@Req() req: Request, @Res() res: Response) {
    const result = await this.payuService.handleCallback((req.body || {}) as Record<string, any>);
    return res.redirect(303, result.redirectUrl);
  }

  @Get('success')
  @ApiOperation({ summary: 'Graceful GET fallback for PayU sURL reload' })
  handleSuccessGet(@Res() res: Response) {
    return res.redirect(303, this.payuService.getFrontendResultUrl('failure'));
  }

  @Post('failure')
  @ApiOperation({ summary: 'PayU fURL callback (application/x-www-form-urlencoded POST)' })
  async handleFailurePost(@Req() req: Request, @Res() res: Response) {
    const result = await this.payuService.handleCallback((req.body || {}) as Record<string, any>);
    return res.redirect(303, result.redirectUrl);
  }

  @Get('failure')
  @ApiOperation({ summary: 'Graceful GET fallback for PayU fURL reload' })
  handleFailureGet(@Res() res: Response) {
    return res.redirect(303, this.payuService.getFrontendResultUrl('failure'));
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'PayU Server-to-Server Webhook callback' })
  async handleWebhook(@Req() req: Request) {
    const result = await this.payuService.handleCallback((req.body || {}) as Record<string, any>);
    return {
      ok: true,
      orderId: result.orderId,
      status: result.status,
    };
  }

  @Get('verify/:orderId')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify PayU transaction status via PayU Verify Payment API' })
  async verify(@CurrentUser() user: any, @Param('orderId') orderId: string) {
    const userId = user ? user._id.toString() : undefined;
    return this.payuService.verifyOrderPayment(orderId, userId);
  }
}
