"use client"
import React, { useEffect, useState } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/local/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const client = createClient();

// Interface for Post data
interface Post {
  id: string;
  title: string;
  pictures: string;
  current_bid: number;
  status: string;
  poster_id: string;
}

// Interface for OrderDetails
interface OrderDetails {
  name: string;
  image: string;
  subtotal: number;
  service_fee: number; // Renamed from shipping
  tax: number;
  total: number;
  vip_discount?: number;  // Optional VIP discount amount
}

// Interface for ShippingAddress
interface ShippingAddress {
  firstName: string;
  lastName: string;
  streetAddress: string;
  city: string;
  state: string;
  zipCode: string;
}

// Interface for Order
interface Order {
  id: string;
  buyer: string;
  seller: string;
  post: string;
  shipping_address: ShippingAddress;
}

const CheckoutPage = () => {
  const { id } = useParams(); // Get the post ID from the URL parameters
  const [post, setPost] = useState<Post | null>(null); // State to store post details
  const [isLoading, setIsLoading] = useState(true); // State to manage loading state
  const [error, setError] = useState<string | null>(null); // State to store error messages
  const [userBalance, setUserBalance] = useState(0); // State to store user balance
  const [orderDetails, setOrderDetails] = useState<OrderDetails>({
    name: '',
    image: '',
    subtotal: 0,
    service_fee: 0, // Renamed from shipping
    tax: 0,
    total: 0,
    vip_discount: 0 // Provide a default value
  }); // State to store order details
  const [shippingAddress, setShippingAddress] = useState<ShippingAddress>({
    firstName: '',
    lastName: '',
    streetAddress: '',
    city: '',
    state: '',
    zipCode: ''
  }); // State to store shipping address
  const [sellerInfo, setSellerInfo] = useState({ 
    username: '', 
  }); // State to store seller information
  const router = useRouter(); // Router instance for navigation

  // Function to fetch post details and user information
  const fetchPost = async () => {
    try {
      // Fetch the current user from local authentication
      const { data: { user }, error: userError } = await client.auth.getUser();
      if (userError) {
        // If there's an error fetching the user, set an error message and redirect to login
        setError('Please login to checkout');
        router.push('/login');
        return;
      }

      // Get user balance, suspension status, and type from the 'Users' table
      const { data: userData, error: balanceError } = await client
        .from('Users')
        .select('balance, suspended, type')
        .eq('id', user?.id)
        .single();

      if (balanceError) throw balanceError;
      setUserBalance(userData.balance);

      // Check if the user is a visitor
      if (userData.type === 'visitor') {
        router.push('/home');
        setError('Visitors cannot make purchases. Please upgrade your account.');
        return;
      }

      // Check if the user's account is suspended
      if (userData.suspended) {
        setError('Your account is suspended. Please reactivate your account to complete the purchase.');
        return;
      }

      // Get post details from the 'post' table
      const { data, error } = await client
        .from('post')
        .select('*')
        .eq('id', id)
        .single();

      if (error) throw error;
      if (!data) throw new Error('Post not found');

      // Verify if the user is the highest bidder
      if (data.highest_bidder !== user?.id) {
        router.push('/home');
        return;
      }

      // Check if the post is already completed
      if (data.status === 'completed') {
        router.push('/home');
        return;
      }

      const pictures = JSON.parse(data.pictures);
      const subtotal = data.current_bid;
      const service_fee = Math.round(subtotal * 0.05); // 5% service fee
      const tax = Math.round(subtotal * 0.08875); // 8.875% tax
      const baseTotal = subtotal + service_fee + tax;
    
      // Apply VIP discount if applicable
      const vip_discount = userData.type === 'vip' ? Math.round(baseTotal * 0.10) : 0;
      const final_total = baseTotal - vip_discount;

      // Set post and order details state
      setPost(data);
      setOrderDetails({
        name: data.title,
        image: pictures[0] || '/placeholder.jpg',
        subtotal,
        service_fee, // Updated
        tax,
        vip_discount,
        total: final_total
      });
    } catch (err) {
      setError('Error loading checkout details');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // useEffect to fetch post details when the component mounts or the post ID changes
  useEffect(() => {
    if (id) fetchPost();
  }, [id]);

  // useEffect to fetch seller information when the post data changes
  useEffect(() => {
    const fetchSeller = async () => {
      const { data, error } = await client
        .from('Users')
        .select('username')
        .eq('id', post?.poster_id)
        .single();

      if (!error && data) {
        setSellerInfo({
          username: data.username,
        });
      }
    };

    if (post?.poster_id) fetchSeller();
  }, [post?.poster_id]);

  // Function to handle the purchase process
  const handlePurchase = async () => {
    try {
      setIsLoading(true);
      
      // Check if the user has sufficient balance
      if (userBalance < orderDetails.total) {
        setError('Insufficient balance');
        return;
      }

      const { data: { user }, error: authError } = await client.auth.getUser();
      if (authError) throw authError;
      
      // Update user balance (buyer)
      const { error: balanceError } = await client
        .from('Users')
        .update({ 
          balance: userBalance - orderDetails.total 
        })
        .eq('id', user?.id);

      if (balanceError) throw balanceError;

      // Create order record with shipping address
      const { data: orderData, error: orderError } = await client
        .from('orders')
        .insert({
          buyer: user?.id,
          seller: post?.poster_id,
          post: post?.id,
          shipping_address: shippingAddress // Add shipping address
        })
        .select('id')
        .single();

      if (orderError) throw orderError;

      // Update post status to completed
      const { error: postError } = await client
        .from('post')
        .update({ status: 'completed' })
        .eq('id', post?.id);

      if (postError) throw postError;

      // Fetch seller's current balance
      const { data: sellerData, error: sellerError } = await client
        .from('Users')
        .select('balance')
        .eq('id', post?.poster_id)
        .single();

      if (sellerError) throw sellerError;

      // Calculate seller's new balance
      const sellerShare = Math.round(orderDetails.subtotal * 0.90);
      const newSellerBalance = (sellerData.balance || 0) + sellerShare;

      // Update seller's balance
      const { error: sellerBalanceError } = await client
        .from('Users')
        .update({ balance: newSellerBalance })
        .eq('id', post?.poster_id);

      if (sellerBalanceError) throw sellerBalanceError;

      // Redirect to rating page with order ID
      router.push(`/rating/${orderData.id}`);
    } catch (err) {
      setError('Failed to process purchase');
      console.error('Purchase error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Function to check if the shipping address form is valid
  const isFormValid = () => {
    return Object.values(shippingAddress).every(value => value.trim() !== '');
  };

  // Render error message if there's an error
  if (error) return (
    <div className="flex justify-center items-center min-h-screen">
      <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4">
        <p className="font-bold">Account Suspended</p>
        <p>{error}</p>
        <Button onClick={() => router.push('/reactivate')} className="mt-2">Reactivate Account</Button>
      </div>
    </div>
  );

  // Render loading state
  if (isLoading) return <div>Loading...</div>;
  if (!post) return <div>Post not found</div>;

  return (
    <div className="max-w-2xl mt-16 mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle>Confirm Purchase</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center space-x-4">
            <img
              src={orderDetails.image}
              alt={orderDetails.name}
              className="w-32 h-32 rounded-lg object-cover"
            />
            <div>
              <h2 className="text-xl font-semibold">{orderDetails.name}</h2>
              <div className="mt-2 text-sm text-gray-500">Purchase Amount</div>
              <div className="text-2xl font-bold">
                ${(orderDetails.subtotal / 100).toFixed(2)}
              </div>
            </div>
          </div>

          <div className="space-y-4">
            <h3 className="font-semibold">Shipping Address</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="firstName">First Name</Label>
                <Input
                  id="firstName"
                  value={shippingAddress.firstName}
                  onChange={(e) => setShippingAddress({
                    ...shippingAddress,
                    firstName: e.target.value
                  })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="lastName">Last Name</Label>
                <Input
                  id="lastName"
                  value={shippingAddress.lastName}
                  onChange={(e) => setShippingAddress({
                    ...shippingAddress,
                    lastName: e.target.value
                  })}
                  required
                />
              </div>
            </div>
            <div>
              <Label htmlFor="address">Street Address</Label>
              <Input
                id="address"
                value={shippingAddress.streetAddress}
                onChange={(e) => setShippingAddress({
                  ...shippingAddress,
                  streetAddress: e.target.value
                })}
                required
              />
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="col-span-2">
                <Label htmlFor="city">City</Label>
                <Input
                  id="city"
                  value={shippingAddress.city}
                  onChange={(e) => setShippingAddress({
                    ...shippingAddress,
                    city: e.target.value
                  })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="state">State</Label>
                <Input
                  id="state"
                  value={shippingAddress.state}
                  onChange={(e) => setShippingAddress({
                    ...shippingAddress,
                    state: e.target.value
                  })}
                  required
                />
              </div>
              <div>
                <Label htmlFor="zipCode">ZIP Code</Label>
                <Input
                  id="zipCode"
                  value={shippingAddress.zipCode}
                  onChange={(e) => setShippingAddress({
                    ...shippingAddress,
                    zipCode: e.target.value
                  })}
                  required
                />
              </div>
            </div>
          </div>

          <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Subtotal</span>
              <span>${(orderDetails.subtotal / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Service Fee</span>
              <span>${(orderDetails.service_fee / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span>Tax </span>
              <span>${(orderDetails.tax / 100).toFixed(2)}</span>
            </div>
            {orderDetails.vip_discount && orderDetails.vip_discount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span>VIP Discount (10%)</span>
                <span>-${((orderDetails.vip_discount ?? 0) / 100).toFixed(2)}</span>
              </div>
            )}
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-bold">
                <span>Total</span>
                <span>${(orderDetails.total / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          <div className="p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-500">Your Balance</div>
            <div className="text-2xl font-bold">
              ${(userBalance / 100).toFixed(2)}
            </div>
          </div>

          <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Current Balance</span>
              <span>${(userBalance / 100).toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-sm text-red-500">
              <span>Purchase Total</span>
              <span>-${(orderDetails.total / 100).toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-bold">
                <span>Remaining Balance</span>
                <span>${((userBalance - orderDetails.total) / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>

          {userBalance < orderDetails.total && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle>Insufficient Balance</AlertTitle>
              <AlertDescription>
                Please reload your balance to complete this purchase.
              </AlertDescription>
            </Alert>
          )}

          <Button 
            className="w-full" 
            onClick={handlePurchase}
            disabled={isLoading || userBalance < orderDetails.total || !isFormValid()}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                Processing... <Check className="w-4 h-4 animate-spin" />
              </span>
            ) : (
              'Confirm Purchase'
            )}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default CheckoutPage;