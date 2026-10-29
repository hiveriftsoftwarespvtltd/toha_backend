export type Method = 'online' | 'cod';

export interface Address {
  name: string;
  address1: string;
  address2?: string;
  city: string;
  state: string;
  zip: string;
  country: 'IN';
}

export interface QuoteItem {
  variantId: string;
  title: string;
  quantity: number;
  unitPriceMinor: number; // In paise (e.g. 140000)
}

export interface Quote {
  quoteId: string;
  cartId: string;
  cartVersion: string;
  currency: 'INR';
  method: Method;
  expiresAt: number;
  items: QuoteItem[];
  subtotalMinor: number;
  discountMinor: number;
  shippingMinor: number;
  taxMinor: number;
  codFeeMinor: number;
  totalMinor: number;
  codAvailable: boolean;
  pricingBase?: string;
  selection?: any;
}

export interface QuoteRequest {
  cartId: string;
  cartVersion: string;
  method?: Method;
  phone?: string;
  address?: Address;
  items?: any[];
  couponCode?: string;
  selection?: any;
}

export interface PrepareRequest {
  cartId: string;
  cartVersion: string;
  quoteId: string;
  attemptId: string;
  phone: string;
  address: Address;
  method: Method;
  items?: any[];
  selection?: any;
}

export interface BoundOrder {
  orderId: string;
  name: string;
  attemptId: string;
  quoteId: string;
  totalMinor: number;
  currency: 'INR';
  method: Method;
  financialStatus: 'paid' | 'pending';
  pricingHash?: string;
  selection?: any;
}

export interface CompleteRequest {
  orderId: string;
  attemptId: string;
  quoteId: string;
  method: Method;
  amountMinor: number;
  currency: 'INR';
  paymentRef?: string;
  providerOrderId?: string;
}

export interface ConnectorRequest {
  version: 1;
  requestId: string;
  action: 'health' | 'quote' | 'prepare' | 'complete' | 'status' | 'release' | 'checkout';
  data: Record<string, any>;
}

export interface ConnectorResponse<T = any> {
  version: 1;
  merchantKey: string;
  requestId: string;
  action: ConnectorRequest['action'];
  ok: true;
  data: T;
}
