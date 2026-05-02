// Consumer page for magic-link sign-in. The link the user gets in their
// email is shaped like /login/magic?token=<opaque>. We pull the token,
// hand it to auth.consumeMagicLink, and redirect on success.

import { useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, XCircle, Sparkles } from "lucide-react";

export default function MagicLogin() {
  const [, navigate] = useLocation();
  const [state, setState] = useState<"loading" | "success" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const fired = useRef(false);
  const consume = trpc.auth.consumeMagicLink.useMutation();

  useEffect(() => {
    // Prevent double-fire from React strict-mode in dev
    if (fired.current) return;
    fired.current = true;

    const params = new URLSearchParams(window.location.search);
    const token = params.get("token");
    if (!token) {
      setState("error");
      setError("This sign-in link is missing its token. Request a new one.");
      return;
    }
    consume.mutate({ token }, {
      onSuccess: r => {
        if (r.ok) {
          setState("success");
          // Tiny delay so the user sees the success state before redirecting
          setTimeout(() => {
            navigate("/");
            window.location.reload();
          }, 700);
        } else {
          setState("error");
          setError(r.reason);
        }
      },
      onError: e => {
        setState("error");
        setError(e.message || "Something went wrong.");
      },
    });
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="p-8 text-center space-y-4">
          <div className="flex justify-center">
            <img
              src="/logo.png"
              alt="Trader Foundation"
              className="w-16 h-16 object-contain"
            />
          </div>

          {state === "loading" && (
            <>
              <Loader2 className="h-10 w-10 mx-auto text-primary animate-spin" />
              <h1 className="text-xl font-bold text-primary">Signing you in…</h1>
              <p className="text-sm text-muted-foreground">
                One moment — verifying your link.
              </p>
            </>
          )}

          {state === "success" && (
            <>
              <CheckCircle2 className="h-10 w-10 mx-auto text-green-400" />
              <h1 className="text-xl font-bold text-green-400">You're in</h1>
              <p className="text-sm text-muted-foreground flex items-center justify-center gap-1">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                Redirecting you to your dashboard…
              </p>
            </>
          )}

          {state === "error" && (
            <>
              <XCircle className="h-10 w-10 mx-auto text-red-400" />
              <h1 className="text-xl font-bold text-red-400">Couldn't sign you in</h1>
              <p className="text-sm text-muted-foreground">
                {error || "This link is no longer valid."}
              </p>
              <Button
                onClick={() => navigate("/")}
                className="bg-primary hover:bg-primary/90 mt-2"
              >
                Request a new link
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
