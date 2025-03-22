import React from "react";
import Head from "next/head";
import Link from "next/link";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "@/components/ui/card";
import { useAuth } from "@/contexts/AuthContext";
import { Code, FileJson, Layers } from "lucide-react";

export default function Home() {
  const { user } = useAuth();

  return (
    <>
      <Head>
        <title>Smart Contract Manager</title>
        <meta name="description" content="Manage your EVM smart contracts with ease" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="bg-background min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center p-8">
          <div className="max-w-4xl w-full text-center mb-12">
            <h1 className="text-5xl font-bold mb-4">Smart Contract Manager</h1>
            <p className="text-xl text-muted-foreground mb-8">
              Easily manage and organize your EVM smart contracts in one place
            </p>
            {user ? (
              <Button size="lg" asChild>
                <Link href="/dashboard">Go to Dashboard</Link>
              </Button>
            ) : (
              <div className="flex gap-4 justify-center">
                <Button size="lg" asChild>
                  <Link href="/login">Log In</Link>
                </Button>
                <Button size="lg" variant="outline" asChild>
                  <Link href="/signup">Sign Up</Link>
                </Button>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
            <Card>
              <CardHeader>
                <Layers className="h-10 w-10 mb-2 text-primary" />
                <CardTitle>Project Management</CardTitle>
                <CardDescription>
                  Organize your smart contracts into projects
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Create multiple projects to keep your contracts organized by purpose, network, or any other criteria.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <FileJson className="h-10 w-10 mb-2 text-primary" />
                <CardTitle>ABI Import</CardTitle>
                <CardDescription>
                  Import contract ABIs from Etherscan or manually
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Easily import contract ABIs by providing an Etherscan link or manually entering the contract details.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <Code className="h-10 w-10 mb-2 text-primary" />
                <CardTitle>Contract Details</CardTitle>
                <CardDescription>
                  View and manage contract information
                </CardDescription>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground">
                  Access contract source code, ABI, and network information all in one place for easy reference.
                </p>
              </CardContent>
            </Card>
          </div>
        </main>
      </div>
    </>
  );
}
