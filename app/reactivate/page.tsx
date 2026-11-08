"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/local/client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

const client = createClient();

const ReactivatePage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [balance, setBalance] = useState(0);
  const fineAmount = 5000; // $50 in cents
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

  useEffect(() => {
    const checkUserStatus = async () => {
      try {
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError) throw userError;
        if (!user) {
          router.push('/login');
          return;
        }

        setUser(user);

        const { data: userData, error: profileError } = await client
          .from('Users')
          .select('suspended, balance, suspended_times')
          .eq('id', user.id)
          .single();

        console.log(userData?.balance)

        if (profileError) throw profileError;

        if (!userData.suspended) {
          router.push('/home');
        } else {
          setBalance(userData.balance);
          if (userData.suspended_times >= 3) {
            setError('Account permanently disabled. Please contact support.');
            return;
          }
        }
        // Inside checkUserStatus function, after fetching user data
        if (userData) {
            setBalance(userData.balance);
        }
      } catch (error) {
        console.error('Error checking user status:', error);
        setError('Failed to check user status');
      } finally {
        setLoading(false);
      }
    };

    checkUserStatus();
  }, [router]);

  const handleReactivate = async () => {
    if (balance < fineAmount) {
      setError('Insufficient funds. Please reload your account.');
      return;
    }

    try {
      setLoading(true);

      const { data: userData } = await client
        .from('Users')
        .select('suspended_times')
        .eq('id', user.id)
        .single();

      if (userData?.suspended_times >= 3) {
        setError('Account permanently disabled. Please contact support.');
        return;
      }

      const { error: balanceError } = await client
        .from('Users')
        .update({ 
          balance: balance - fineAmount, 
          suspended: false,
          suspended_times: (userData?.suspended_times || 0) + 1,
          bad_review: 0 // Reset bad reviews to 0
        })
        .eq('id', user.id);

      if (balanceError) throw balanceError;

      router.push('/home');
    } catch (error) {
      console.error('Error reactivating account:', error);
      setError('Failed to reactivate account');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;
  if (!authorized) {
    return null;
  }

  const remainingBalance = balance - fineAmount;

  return (
    <div className="max-w-3xl mt-16 mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-center">
            Reactivate Your Account
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-5">
          <p>Your account has been suspended. To continue using the app, please pay the $50 fine.</p>
          <ul className="list-disc list-inside space-y-2">
            <li>If your account is suspended more than 3 times, it will be disabled.</li>
            <li>You can contact support if you think you have been wrongfully rated.</li>
          </ul>
          <div className="space-y-2 p-4 bg-gray-50 rounded-lg">
            <div className="flex justify-between text-sm">
              <span>Current Balance</span>
              <span>${(balance / 100).toFixed(2)}</span> {/* Ensure balance is displayed in dollars */}
            </div>
            <div className="flex justify-between text-sm text-red-500">
              <span>Reactivation Fee</span>
              <span>-${(fineAmount / 100).toFixed(2)}</span>
            </div>
            <div className="border-t pt-2 mt-2">
              <div className="flex justify-between font-bold">
                <span>Remaining Balance</span>
                <span>${(remainingBalance / 100).toFixed(2)}</span>
              </div>
            </div>
          </div>
          {balance < fineAmount && (
            <div className="text-red-500 text-center">
              Insufficient funds. Please reload your account.
            </div>
          )}
          <Button 
            className="w-full mt-4" 
            onClick={handleReactivate}
            disabled={balance < fineAmount}
          >
            Pay $50 to Reactivate Account
          </Button>
          <Button className="w-full mt-2" variant="outline" onClick={() => router.push('/support')}>
            Contact Support
          </Button>
        </CardContent>
      </Card>
    </div>
  );
};

export default ReactivatePage;