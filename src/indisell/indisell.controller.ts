import {
  Controller,
  Post,
  Req,
  Res,
  Headers,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { Request, Response } from 'express';
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
   * Invoked by widget-custom.js on frontend (POST /api/checkout/session)
   */
  @Post('checkout/session')
  @ApiOperation({ summary: 'Storefront: Create IndiSell 1-click checkout session' })
  async createSession(@Req() req: Request, @Res() res: Response) {
    return this.indisellService.handleSessionBridge(req, res);
  }

  /**
   * Storefront bridge: Verify session completion
   * Invoked by widget-custom.js upon completion (POST /api/checkout/verify)
   */
  @Post('checkout/verify')
  @ApiOperation({ summary: 'Storefront: Verify IndiSell checkout completion' })
  async verifySession(@Req() req: Request, @Res() res: Response) {
    return this.indisellService.handleVerifyBridge(req, res);
  }

  /**
   * Helper endpoint: Sync cart items to backend before opening checkout
   */
  @Post('checkout/sync-cart')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Storefront: Sync cart to backend before opening checkout' })
  async syncCart(
    @Body() body: { customerId: string; cartId: string; items: any[]; subtotal?: number },
  ) {
    if (!body || !body.cartId) {
      return { ok: false, error: 'cartId_required' };
    }
    const customerId = body.customerId || `guest_${body.cartId}`;
    await this.indisellService.syncOwnedCart(customerId, body.cartId, body.items || [], body.subtotal);
    return { ok: true, cartId: body.cartId, customerId };
  }
}
