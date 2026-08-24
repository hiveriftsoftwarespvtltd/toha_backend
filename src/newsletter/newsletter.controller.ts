import { Controller, Post, Delete, Body, Param } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { NewsletterService } from './newsletter.service';

@ApiTags('Newsletter')
@Controller('newsletter')
export class NewsletterController {
  constructor(private readonly newsletterService: NewsletterService) {}

  @Post('subscribe')
  @ApiOperation({ summary: 'Subscribe email to Tohay Kids newsletter' })
  async subscribe(@Body('email') email: string) {
    const data = await this.newsletterService.subscribe(email);
    return { success: true, message: 'Thank you for subscribing to Tohay Kids! 🎉', data };
  }

  @Delete('unsubscribe/:email')
  @ApiOperation({ summary: 'Unsubscribe email' })
  async unsubscribe(@Param('email') email: string) {
    await this.newsletterService.unsubscribe(email);
    return { success: true, message: 'Unsubscribed successfully', data: { email } };
  }
}
