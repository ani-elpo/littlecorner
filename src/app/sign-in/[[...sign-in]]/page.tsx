import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <main className="flex-1 flex flex-col items-center justify-center px-4 py-16">
      <div className="text-center mb-8">
        <h1 className="font-display text-3xl sm:text-4xl text-ink tracking-tight">
          our little corner
        </h1>
        <p className="font-body italic text-ink/60 mt-2">
          a private board, just for the two of us
        </p>
      </div>
      <SignIn
        appearance={{
          elements: {
            rootBox: "mx-auto",
            card: "bg-paper border border-ink/15 shadow-lg rounded-sm",
          },
        }}
      />
    </main>
  );
}
