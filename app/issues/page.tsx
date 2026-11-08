'use client'

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/local/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { User } from '@/lib/local/types';

const client = createClient();

interface Issue {
  id: string;
  created_at: string;
  comments: string;
  response: Array<{
    username: string;
    message: string;
    timestamp: string;
  }> | null;
  issuer: {
    username: string;
  };
  status: string;
}

const IssuesPage = () => {
  const [user, setUser] = useState<User | null>(null);
  const [issues, setIssues] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [authorized, setAuthorized] = useState(false);
  const router = useRouter();

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
    const fetchIssues = async () => {
      try {
        const { data: { user }, error: userError } = await client.auth.getUser();
        if (userError) throw userError;
        setUser(user);

        const { data: issuesData, error: issuesError } = await client
          .from('issues')
          .select(`
            id,
            created_at,
            comments,
            response,
            issuer ( username ),
            status
          `)
          .or(`issuer.eq.${user?.id},issuee.eq.${user?.id}`)
          .order('created_at', { ascending: false });

        if (issuesError) throw issuesError;
        setIssues(issuesData || []);
      } catch (error) {
        setError('Failed to load issues');
        console.error('Error fetching issues:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchIssues();
  }, []);

  if (!authorized) {
    return null;
  }

  if (loading) return <div>Loading...</div>;
  if (error) return <div>{error}</div>;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'initiated':
        return 'bg-red-500';
      case 'under-review':
        return 'bg-yellow-500';
      case 'resolved':
        return 'bg-green-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">My Issues</h1>
      <div className="space-y-4">
        {issues.length === 0 ? (
          <div className="text-center text-gray-500">No issues found</div>
        ) : (
          issues.map(issue => (
            <Card
              key={issue.id}
              className="cursor-pointer hover:shadow-lg transition-shadow"
              onClick={() => router.push(`/issues/${issue.id}`)}
            >
              <CardHeader className="flex flex-row justify-between items-center">
                <div>
                  <CardTitle className="text-base font-medium">
                    Issue reported by {issue.issuer.username}
                  </CardTitle>
                  <p className="text-sm text-gray-500">
                    {new Date(issue.created_at).toLocaleDateString()}
                  </p>
                </div>
                <span className={`text-white px-2 py-1 rounded ${getStatusColor(issue.status)}`}>
                  {issue.status}
                </span>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-gray-600">{issue.comments}</p>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
};

export default IssuesPage;