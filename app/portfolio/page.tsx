import { Hero } from "@/components/portfolio/Hero";
import { About } from "@/components/portfolio/About";
import { TechStack } from "@/components/portfolio/TechStack";
import { Projects } from "@/components/portfolio/Projects";
import { Experience } from "@/components/portfolio/Experience";
import { Services } from "@/components/portfolio/Services";
import { Contact } from "@/components/portfolio/Contact";

export default function PortfolioPage() {
  return (
    <>
      <Hero />
      <About />
      <Projects />
      <TechStack />
      <Experience />
      <Services />
      <Contact />
    </>
  );
}
