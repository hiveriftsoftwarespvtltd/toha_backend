import {
  Controller,
  Post,
  Req,
  Body,
  Headers,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request } from 'express';
import { IndiSellService } from './indisell.service';

@ApiTags('IndiSell 1-Click Checkout')
@Controller()
export class IndiSellController {
  constructor(private readonly indisellService: IndiSellService) {}

  /**
   * Signed server-to-server connector endpoint invoked by IndiSell
   * Actions: health, quote, prepare, complete, status, release
   */
  @Post('indisell/connector')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'IndiSell: Signed server-to-server commerce connector' })
  async handleConnector(
    @Req() req: any,
    @Headers() headers: Record<string, string>,
  ) {
    const rawBody = req.rawBody || JSON.stringify(req.body || {});
    return this.indisellService.handleConnector(rawBody, headers);
  }

  /**
   * Storefront bridge: Create session
   * Invoked by widget-custom.js on frontend
   */
  @Post('checkout/session')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Storefront: Create IndiSell 1-click checkout session' })
  async createSession(
    @Req() req: any,
    @Body() body: { cartId: string; cartVersion?: string },
  ) {
    const userId = req.user ? (req.user._id || req.user.id)?.toString() : null;
    return this.indisellService.createCheckoutSession(userId, body.cartId, body.cartVersion || 'v1');
  }

  /**
   * Storefront bridge: Verify session completion
   * Invoked by widget-custom.js upon completion
   */
  @Post('checkout/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Storefront: Verify IndiSell checkout completion' })
  async verifySession(
    @Req() req: any,
    @Body() body: { checkoutSessionId: string },
  ) {
    const userId = req.user ? (req.user._id || req.user.id)?.toString() : null;
    return this.indisellService.verifyCheckoutSession(userId, body.checkoutSessionId);
  }
}
