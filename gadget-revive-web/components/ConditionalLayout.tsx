import TopBar from './TopBar';
import Header from './Header';
import Footer from './Footer';

export default function ConditionalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      <TopBar />
      <Header />
      <main className="flex-1 flex flex-col [&>*]:flex-1">
        {children}
      </main>
      <Footer />
    </div>
  );
}
