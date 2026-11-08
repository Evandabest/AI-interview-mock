"use client"

import React, { useState } from 'react';
import { 
  CreditCard, 
  Check,
  ChevronDown,
  AlertCircle
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const CheckoutPage = () => {
  const [paymentMethod, setPaymentMethod] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);

  // Placeholder order details
  const orderDetails = {
    subtotal: 150.00,
    shipping: 10.00,
    tax: 12.00,
    total: 172.00,
  };

  const handleQuickPayment = (method: string) => {
    setIsLoading(true);
    // Simulate payment processing
    setTimeout(() => {
      setIsLoading(false);
      console.log(`Processing ${method} payment`);
    }, 2000);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate payment processing
    setTimeout(() => {
      setIsLoading(false);
      console.log('Processing traditional checkout');
    }, 2000);
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {/* Left Column - Payment Options */}
        <div className="space-y-6">
          <h1 className="text-2xl font-bold">Checkout</h1>

          {/* Product Preview Image */}
          <div className="md:hidden mb-6">
            <img
              src="/api/placeholder/400/300"
              alt="Product Preview"
              className="w-full rounded-lg object-cover"
            />
          </div>
          
          {/* Quick Payment Options */}
          <div className="space-y-4">
            <h2 className="text-lg font-semibold">Quick Payment</h2>
            <div className="grid grid-cols-1 gap-3">
              <Button 
                variant="outline" 
                className="h-16 relative"
                onClick={() => handleQuickPayment('paypal')}
                disabled={isLoading}
              >
                <img 
                  src="/api/placeholder/120/40" 
                  alt="PayPal" 
                  className="absolute left-4"
                />
                <ChevronDown className="absolute right-4 w-4 h-4" />
              </Button>
              
              <Button 
                variant="outline" 
                className="h-16 relative"
                onClick={() => handleQuickPayment('apple')}
                disabled={isLoading}
              >
                <img 
                  src="/api/placeholder/120/40" 
                  alt="Apple Pay" 
                  className="absolute left-4"
                />
                <ChevronDown className="absolute right-4 w-4 h-4" />
              </Button>
              
              <Button 
                variant="outline" 
                className="h-16 relative"
                onClick={() => handleQuickPayment('google')}
                disabled={isLoading}
              >
                <img 
                  src="/api/placeholder/120/40" 
                  alt="Google Pay" 
                  className="absolute left-4"
                />
                <ChevronDown className="absolute right-4 w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-white text-gray-500">Or pay with card</span>
            </div>
          </div>

          {/* Traditional Checkout Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Contact Information */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Contact Information</h2>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" required />
              </div>
            </div>

            {/* Shipping Address */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Shipping Address</h2>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName">First Name</Label>
                  <Input id="firstName" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName">Last Name</Label>
                  <Input id="lastName" required />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="address">Address</Label>
                <Input id="address" required />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="city">City</Label>
                  <Input id="city" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="state">State</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="Select state" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ca">California</SelectItem>
                      <SelectItem value="ny">New York</SelectItem>
                      <SelectItem value="tx">Texas</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zip">ZIP Code</Label>
                  <Input id="zip" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input id="phone" type="tel" required />
                </div>
              </div>
            </div>

            {/* Payment Information */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Payment Information</h2>
              <div className="space-y-2">
                <Label htmlFor="cardNumber">Card Number</Label>
                <Input id="cardNumber" required />
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="expMonth">Expiry Month</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="MM" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 12 }, (_, i) => (
                        <SelectItem key={i + 1} value={String(i + 1).padStart(2, '0')}>
                          {String(i + 1).padStart(2, '0')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="expYear">Expiry Year</Label>
                  <Select>
                    <SelectTrigger>
                      <SelectValue placeholder="YY" />
                    </SelectTrigger>
                    <SelectContent>
                      {Array.from({ length: 10 }, (_, i) => (
                        <SelectItem key={i} value={String(new Date().getFullYear() + i).slice(-2)}>
                          {String(new Date().getFullYear() + i).slice(-2)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cvc">CVC</Label>
                  <Input id="cvc" maxLength={4} required />
                </div>
              </div>
            </div>

            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? (
                <span className="flex items-center gap-2">
                  Processing... <Check className="w-4 h-4 animate-spin" />
                </span>
              ) : (
                `Pay $${orderDetails.total.toFixed(2)}`
              )}
            </Button>
          </form>
        </div>

        {/* Right Column - Product Image and Order Summary */}
        <div className="space-y-6">
          {/* Product Preview Image - Desktop Only */}
          <div className="hidden md:block">
            <img
              src="/api/placeholder/400/300"
              alt="Product Preview"
              className="w-full rounded-lg object-cover mb-6"
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Order Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-gray-600">Subtotal</span>
                  <span>${orderDetails.subtotal.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Shipping</span>
                  <span>${orderDetails.shipping.toFixed(2)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Tax</span>
                  <span>${orderDetails.tax.toFixed(2)}</span>
                </div>
                <div className="pt-4 border-t">
                  <div className="flex justify-between font-semibold">
                    <span>Total</span>
                    <span>${orderDetails.total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="mt-6">
            <Accordion type="single" collapsible>
              <AccordionItem value="security">
                <AccordionTrigger>
                  <span className="flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Secure Checkout
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <p className="text-sm text-gray-600">
                    Your payment information is encrypted and secure. We never store your credit card details.
                  </p>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;