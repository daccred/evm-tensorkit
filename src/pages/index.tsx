import React from "react";
import Head from "next/head";
import Header from "@/components/Header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";

export default function Home() {
  return (
    <>
      <Head>
        <title>Codev</title>
        <meta name="description" content="Generated by Codev" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      <div className="bg-background min-h-screen flex flex-col">
        <Header />
        <main className="flex-1 flex flex-col items-center justify-center p-4">
          <Card className="w-[350px]">
            <CardHeader>
              <CardTitle>Welcome to your app</CardTitle>
              <CardDescription>Use the prompt to modify the page.</CardDescription>
            </CardHeader>
            <CardContent>
              <Button className="w-full">Get Started</Button>
            </CardContent>
          </Card>
        </main>
      </div>
    </>
  );
}
