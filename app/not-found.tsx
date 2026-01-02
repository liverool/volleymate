export const dynamic = "force-dynamic";

export default function NotFound() {
  return (
    <main style={{ padding: 24 }}>
      <h1>Fant ikke siden</h1>
      <p>Siden finnes ikke eller er flyttet.</p>
      <a href="/">Til forsiden</a>
    </main>
  );
}
