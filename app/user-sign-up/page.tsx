"use client"
import { createClient } from '@/lib/local/client';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CheckCircle2, XCircle, Wallet, Package, Tag, Users } from "lucide-react";
import { useToast } from '@/hooks/use-toast';

const client = createClient();

export default function UserApplicationPage() {
  const { toast } = useToast();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [username, setUsername] = useState('');
  const [currentUsername, setCurrentUsername] = useState('');
  const [email, setEmail] = useState('');
  const [currentEmail, setCurrentEmail] = useState('');
  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    const { data: { user } } = await client.auth.getUser();
    
    if (!user) {
      router.push('/login');
      return;
    }

    const { data: userData } = await client
      .from('Users')
      .select('type, username, email')
      .eq('id', user.id)
      .single();

    if (userData?.type === 'user') {
      router.push('/home');
      return;
    }

    // Check for existing application
    const { data: existingApplication } = await client
      .from('application')
      .select('status')
      .eq('user_id', user.id)
      .single();

    if (existingApplication && existingApplication.status == 'initiated' || existingApplication?.status == 'under-review') {
      toast({
        title: "Application Pending",
        description: "You already have a submitted application being reviewed.",
        duration: 3000,
      });
      router.push('/home');
      return;
    }

    setCurrentUsername(userData?.username || '');
    setCurrentEmail(userData?.email || '');
    setLoading(false);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    if (username !== currentUsername) {
      toast({
        variant: "destructive",
        title: "Username Mismatch",
        description: "Please enter your current username",
      });
      return;
    }

    if (email !== currentEmail) {
      toast({
        variant: "destructive",
        title: "Email Mismatch",
        description: "Please enter your current email",
      });
      return;
    }
    
    setSubmitting(true);

    const { data: { user } } = await client.auth.getUser();
    
    const { error } = await client
      .from('application')
      .insert([{
        user_id: user?.id,
        username,
        email
      }]);

    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to submit application. Please try again.",
      });
    } else {
      toast({
        title: "Application Submitted!",
        description: "A moderator will review your application soon.",
        duration: 5000,
      });
      setUsername('');
      setEmail('');
    }

    setSubmitting(false);
  }

  if (loading) {
    return <div className="flex justify-center items-center min-h-screen">Loading...</div>;
  }

  return (
    <div className="container mx-auto mt-16 px-4 py-8 max-w-6xl">
      <h1 className="text-3xl font-bold text-center mb-8">
        Upgrade Your Account
      </h1>
      
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5" />
              Visitor Access
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>View auction listings</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>Comment on items</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span>Cannot place bids</span>
            </div>
            <div className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-red-500" />
              <span>Cannot create listings</span>
            </div>
          </CardContent>
        </Card>

        <Card className="border-blue-200 bg-blue-50/50">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Tag className="h-5 w-5" />
              User Benefits
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>Place bids on items</span>
            </div>
            <div className="flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-green-500" />
              <span>Create auction listings</span>
            </div>
            <div className="flex items-center gap-2">
              <Wallet className="h-5 w-5 text-green-500" />
              <span>Load account balance</span>
            </div>
            <div className="flex items-center gap-2">
              <Package className="h-5 w-5 text-green-500" />
              <span>Manage your listings</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Apply for User Status</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Confirm Username</Label>
                <Input
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder={`Enter your username (${currentUsername})`}
                  required
                  disabled={submitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Confirm Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder={`Enter your email (${currentEmail})`}
                  required
                  disabled={submitting}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Application"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}