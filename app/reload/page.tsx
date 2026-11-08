"use client"

import React, { useEffect, useState } from 'react';
import { Loader2, ChevronDown, CreditCard, User, AlertCircle, AlertTriangle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { createClient } from '@/lib/local/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast, toast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

const client = createClient();

interface UserData {
  type: string;
  suspended: boolean;
  id: string;
  username: string;
  email: string;
  balance: number;
}

interface WithdrawData {
  method: 'bank' | 'bitcoin';
  amount: string;
  destination: string;
  bankName?: string;
  accountName?: string;
  routingNumber?: string;
  accountType?: 'checking' | 'savings';
}

const convertToCents = (amount: string): number => {
  return Math.round(parseFloat(amount) * 100);
};

const checkVIPEligibility = async (userId: string, balance: number) => {
  // Only check if balance is over $5000
  if (balance < 500000) return false;

  try {
    // Check for issues where user is issuee but not issuer
    const { data: issues, error: issuesError } = await client
      .from('issues')
      .select('id')
      .eq('issuee', userId)
      .not('issuer', 'eq', userId);

    if (issuesError) throw issuesError;

    // If user has any issues against them, they're not eligible
    if (issues && issues.length > 0) return false;

    // Check order count
    const { count, error: ordersError } = await client
      .from('orders')
      .select('id', { count: 'exact' })
      .eq('buyer', userId);

    if (ordersError) throw ordersError;

    // Must have more than 5 orders
    return count && count > 5;
  } catch (error) {
    console.error('Error checking VIP eligibility:', error);
    return false;
  }
};

const AccountPage = () => {
  const [user, setUser] = useState<UserData | null>(null);
  const [amount, setAmount] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    username: '',
    email: '',
  });
  const [isAddingCard, setIsAddingCard] = useState(false);
  const [cardData, setCardData] = useState({
    cardNumber: '',
    expMonth: '',
    expYear: '',
    cvc: ''
  });
  const [isWithdrawing, setIsWithdrawing] = useState(false);
  const [withdrawData, setWithdrawData] = useState<WithdrawData>({
    method: 'bank',
    amount: '',
    destination: '',
    bankName: '',
    accountName: '',
    routingNumber: '',
    accountType: 'checking'
  });
  const router = useRouter();

  const [authorized, setAuthorized] = useState(false);

  useEffect(() => {
    const checkAuthorization = async () => {
      const { data: { user }, error: authError } = await client.auth.getUser();
      
      if (authError || !user) {
        router.push('/home');
        return;
      }
  
      const { data: userData, error: userError } = await client
        .from('Users')
        .select('type')
        .eq('id', user.id)
        .single();
  
      if (userError || userData?.type === 'visitor') {
        router.push('/home');
        return;
      }
  
      setAuthorized(true);
    };
  
    checkAuthorization();
  }, []);

  const fetchUser = async () => {
    try {
      const { data: { user: authUser }, error: authError } = await client.auth.getUser();
      if (authError) throw authError;

      const { data, error } = await client
        .from('Users')
        .select('*')
        .eq('id', authUser?.id)
        .single();

      if (error) throw error;
      setUser(data);
      setFormData({
        username: data.username || '',
        email: data.email || '',
      });
    } catch (err) {
      setError('Error loading user data');
    } finally {
      setIsLoading(false);
    }
  };

  const handlePayment = async (method: string) => {
    setIsProcessing(true);
    try {
      const amountInCents = convertToCents(amount);
      if (isNaN(amountInCents) || amountInCents <= 0) {
        throw new Error('Please enter a valid amount');
      }

      // Calculate new balance
      const newBalance = (user?.balance || 0) + amountInCents;

      // Update balance
      const { error: updateError } = await client
        .from('Users')
        .update({ balance: newBalance })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      // Check VIP eligibility if not already VIP
      if (user?.type !== 'vip') {
        const isEligible = await checkVIPEligibility(user?.id!, newBalance);
        
        if (isEligible) {
          // Upgrade to VIP
          const { error: vipError } = await client
            .from('Users')
            .update({ type: 'vip' })
            .eq('id', user?.id);

          if (vipError) throw vipError;

          toast({
            title: "🎉 Congratulations!",
            description: "You've been upgraded to VIP status!",
            duration: 5000,
          });
        }
      }

      await fetchUser();
      setAmount('');
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleCardSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const amountInCents = convertToCents(amount);
      if (isNaN(amountInCents) || amountInCents <= 0) {
        throw new Error('Please enter a valid amount');
      }

      // Validate card details here
      if (!cardData.cardNumber || !cardData.expMonth || !cardData.expYear || !cardData.cvc) {
        throw new Error('Please fill in all card details');
      }

      // Simulate card processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const newBalance = (user?.balance || 0) + amountInCents;

      const { error: updateError } = await client
        .from('Users')
        .update({ balance: newBalance })
        .eq('id', user?.id);

      if (updateError) throw updateError;

      if (user?.type !== 'vip') {
        const isEligible = await checkVIPEligibility(user?.id!, newBalance);
        
        if (isEligible) {
          const { error: vipError } = await client
            .from('Users')
            .update({ type: 'vip' })
            .eq('id', user?.id);

          if (vipError) throw vipError;

          toast({
            title: "🎉 Congratulations!",
            description: "You've been upgraded to VIP status!",
            duration: 5000,
          });
        }
      }

      await fetchUser();
      setAmount('');
      setIsAddingCard(false);
      setCardData({
        cardNumber: '',
        expMonth: '',
        expYear: '',
        cvc: ''
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsProcessing(true);
    try {
      const amountInCents = convertToCents(withdrawData.amount);
      
      if (isNaN(amountInCents) || amountInCents <= 0) {
        throw new Error('Please enter a valid amount');
      }
      
      if (amountInCents > (user?.balance || 0)) {
        throw new Error('Insufficient balance');
      }

      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 2000));

      const { error } = await client
        .from('Users')
        .update({ 
          balance: (user?.balance || 0) - amountInCents 
        })
        .eq('id', user?.id);

      if (error) throw error;
      
      await fetchUser();
      setIsWithdrawing(false);
      setWithdrawData({
        method: 'bank',
        amount: '',
        destination: '',
        bankName: '',
        accountName: '',
        routingNumber: '',
        accountType: 'checking'
      });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    fetchUser();
  }, []);

  if (!authorized) {
    return null;
  }

  if (isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-6 h-6 animate-spin" />
      </div>
    );
  }

  if (!user) return <div>User not found</div>;

  return (
    <div className="max-w-2xl mt-16 mx-auto px-4 py-8">
      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Account Balance</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="flex items-center space-x-4">
              <div>
                <h2 className="text-xl font-semibold">{user.username}</h2>
                <p className="text-gray-500">{user.email}</p>
              </div>
            </div>

            <div className="p-4 bg-gray-50 rounded-lg">
              <div className="text-sm text-gray-500">Current Balance</div>
              <div className="text-3xl font-bold">
                ${((user.balance || 0) / 100).toFixed(2)}
              </div>
              <Button
                variant="outline"
                className="w-full mt-4"
                onClick={() => setIsWithdrawing(true)}
                disabled={user.suspended} // Disable the button if the user is suspended
              >
                Withdraw Funds
              </Button>
              {user.suspended && ( // Show a message if the user is suspended
                <div className="text-red-500 text-center mt-2">
                  You need to reactivate your account before you can withdraw your funds.
                </div>
              )}
            </div>

            <Dialog open={isWithdrawing} onOpenChange={setIsWithdrawing}>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Withdraw Funds</DialogTitle>
                  <DialogDescription>
                    Choose your withdrawal method and enter amount
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleWithdraw}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label>Amount to Withdraw</Label>
                      <Input
                        type="number"
                        placeholder="Enter amount"
                        value={withdrawData.amount}
                        onChange={(e) => setWithdrawData({
                          ...withdrawData,
                          amount: e.target.value
                        })}
                        min="0.01"
                        step="0.01"
                        max={((user?.balance || 0) / 100).toString()}
                        required
                      />
                      <p className="text-sm text-gray-500">
                        Available Balance: ${((user?.balance || 0) / 100).toFixed(2)}
                      </p>
                    </div>

                    <div className="space-y-2">
                      <Label>Withdrawal Method</Label>
                      <Select
                        value={withdrawData.method}
                        onValueChange={(value: 'bank' | 'bitcoin') => 
                          setWithdrawData({...withdrawData, method: value})
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select method" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="bank">Bank Transfer</SelectItem>
                          <SelectItem value="bitcoin">Bitcoin</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>

                    <div className="space-y-2">
                      {withdrawData.method === 'bank' ? (
                        <>
                          <div className="space-y-4">
                            <div className="space-y-2">
                              <Label>Bank Name</Label>
                              <Input
                                placeholder="Enter bank name"
                                value={withdrawData.bankName}
                                onChange={(e) => setWithdrawData({
                                  ...withdrawData,
                                  bankName: e.target.value
                                })}
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Account Holder Name</Label>
                              <Input
                                placeholder="Enter account holder name"
                                value={withdrawData.accountName}
                                onChange={(e) => setWithdrawData({
                                  ...withdrawData,
                                  accountName: e.target.value
                                })}
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Account Number</Label>
                              <Input
                                placeholder="Enter account number"
                                value={withdrawData.destination}
                                onChange={(e) => setWithdrawData({
                                  ...withdrawData,
                                  destination: e.target.value
                                })}
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Routing Number</Label>
                              <Input
                                placeholder="Enter routing number"
                                value={withdrawData.routingNumber}
                                onChange={(e) => setWithdrawData({
                                  ...withdrawData,
                                  routingNumber: e.target.value
                                })}
                                required
                              />
                            </div>

                            <div className="space-y-2">
                              <Label>Account Type</Label>
                              <Select
                                value={withdrawData.accountType}
                                onValueChange={(value: 'checking' | 'savings') => 
                                  setWithdrawData({...withdrawData, accountType: value})
                                }
                              >
                                <SelectTrigger>
                                  <SelectValue placeholder="Select account type" />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="checking">Checking</SelectItem>
                                  <SelectItem value="savings">Savings</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="space-y-4">
                          <div className="p-4 bg-red-50 border border-red-200 rounded-lg flex gap-3">
                            <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0 mt-0.5" />
                            <div className="text-sm text-red-700">
                              <span className="font-semibold block mb-1">Warning: Bitcoin transactions are irreversible</span>
                              <p>Double-check your Bitcoin address carefully. If you enter the wrong address, your funds cannot be recovered.</p>
                            </div>
                          </div>
                          
                          <div className="space-y-2">
                            <Label>Bitcoin Address</Label>
                            <Input
                              placeholder="Enter Bitcoin address"
                              value={withdrawData.destination}
                              onChange={(e) => setWithdrawData({
                                ...withdrawData,
                                destination: e.target.value
                              })}
                              required
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setIsWithdrawing(false)}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      disabled={isProcessing}
                    >
                      {isProcessing ? 'Processing...' : 'Withdraw'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Quick Payment</h2>
              <div className="space-y-3">
                <Input
                  type="number"
                  placeholder="Enter amount to reload"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  min="0"
                  step="0.01"
                  disabled={isProcessing}
                />

                <Button 
                  variant="outline" 
                  className="w-full h-14 relative"
                  onClick={() => handlePayment('paypal')}
                  disabled={isProcessing}
                >
                  <img 
                    src="https://play-lh.googleusercontent.com/xOKbvDt362x1uzW-nnggP-PgO9HM4L1vwBl5HgHFHy_n1X3mqeBtOSoIyNJzTS3rrj70" 
                    alt="PayPal" 
                    className="absolute left-4 h-8 w-8"
                  /> PayPal
                  <ChevronDown className="absolute right-4 w-4 h-4" />
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full h-14 relative"
                  onClick={() => handlePayment('apple')}
                  disabled={isProcessing}
                >
                  <img 
                    src="https://static-00.iconduck.com/assets.00/apple-pay-icon-2048x1594-cl3st1bm.png" 
                    alt="Apple Pay" 
                    className="absolute left-4 h-8 w-10"
                  /> Apple Pay
                  <ChevronDown className="absolute right-4 w-4 h-4" />
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full h-14 relative"
                  onClick={() => handlePayment('google')}
                  disabled={isProcessing}
                >
                  <img 
                    src="https://cdn-icons-png.flaticon.com/512/6124/6124998.png" 
                    alt="Google Pay" 
                    className="absolute left-4 h-8 w-8"
                  /> Google Pay
                  <ChevronDown className="absolute right-4 w-4 h-4" />
                </Button>

                <Button 
                  variant="outline" 
                  className="w-full h-14 relative"
                  onClick={() => handlePayment('bitcoin')}
                  disabled={isProcessing}
                >
                  <img 
                    src="https://cdn-icons-png.flaticon.com/512/5968/5968260.png" 
                    alt="Bitcoin" 
                    className="absolute left-4 h-8 w-8"
                  /> Bitcoin
                  <ChevronDown className="absolute right-4 w-4 h-4" />
                </Button>
              </div>
            </div>

            <Dialog open={isAddingCard} onOpenChange={setIsAddingCard}>
              <DialogTrigger asChild>
                <Button 
                  variant="outline" 
                  className="w-full h-14 relative"
                  disabled={isProcessing}
                >
                  <CreditCard className="absolute left-4 w-6 h-6" />
                  Add Credit Card
                  <ChevronDown className="absolute right-4 w-4 h-4" />
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Add Credit Card</DialogTitle>
                  <DialogDescription>
                    Enter your card details to reload your balance
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCardSubmit}>
                  <div className="space-y-4 py-4">
                    <div className="space-y-2">
                      <Label htmlFor="cardNumber">Card Number</Label>
                      <Input
                        id="cardNumber"
                        placeholder="1234 5678 9012 3456"
                        value={cardData.cardNumber}
                        onChange={(e) => setCardData({...cardData, cardNumber: e.target.value})}
                        required
                      />
                    </div>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label htmlFor="expMonth">Month</Label>
                        <Select onValueChange={(value) => setCardData({...cardData, expMonth: value})}>
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
                        <Label htmlFor="expYear">Year</Label>
                        <Select onValueChange={(value) => setCardData({...cardData, expYear: value})}>
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
                        <Input
                          id="cvc"
                          maxLength={4}
                          value={cardData.cvc}
                          onChange={(e) => setCardData({...cardData, cvc: e.target.value})}
                          required
                        />
                      </div>
                    </div>
                  </div>
                  <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setIsAddingCard(false)}>
                      Cancel
                    </Button>
                    <Button type="submit" disabled={isProcessing}>
                      {isProcessing ? 'Processing...' : 'Add Card'}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>

            {error && (
              <div className="flex items-center gap-2 text-red-500 text-sm">
                <AlertCircle className="w-4 h-4" />
                {error}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default AccountPage;

