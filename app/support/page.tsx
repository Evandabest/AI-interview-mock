"use client"

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/local/client';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

const client = createClient();

const SupportPage = () => {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [isSuspended, setIsSuspended] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);

  useEffect(() => {
    const fetchUser = async () => {
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
          .select('suspended')
          .eq('id', user.id)
          .single();

        if (profileError) throw profileError;

        setIsSuspended(userData.suspended);
      } catch (error) {
        console.error('Error fetching user data:', error);
        setError('Failed to fetch user data');
      } finally {
        setLoading(false);
      }
    };

    fetchUser();
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      setLoading(true);

      const finalMessage = isSuspended ? `Account suspended: ${message}` : message;

      const { error } = await client
        .from('issues')
        .insert({
          issuer: user.id,
          issuee: user.id,
          comments: finalMessage,
          status: 'initiated'
        });

      if (error) throw error;

      setMessage('');
      setIsDialogOpen(true); // Open the dialog after successful submission
    } catch (error) {
      console.error('Error submitting issue:', error);
      setError('Failed to submit issue');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  return (
    <div className="max-w-3xl mt-16 mx-auto px-4 py-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold text-center">
            Contact Customer Support
          </CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="message">Message</Label>
              <Textarea
                id="message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Submit
            </Button>
          </form>
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Message Submitted</DialogTitle>
            <DialogDescription>
              A moderator will see your message soon. Thanks for being patient.
            </DialogDescription>
            <Button onClick={() => router.push('/home')} className="mt-4">
              Close
            </Button>
          </DialogHeader>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SupportPage;