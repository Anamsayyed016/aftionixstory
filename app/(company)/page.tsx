import type { Metadata } from "next";
import { Hero } from "@/components/company/sections/Hero";
import { About } from "@/components/company/sections/About";
import { Services } from "@/components/company/sections/Services";
import { WhyChooseUs } from "@/components/company/sections/WhyChooseUs";
import { Process } from "@/components/company/sections/Process";
import { Technologies } from "@/components/company/sections/Technologies";

export const metadata: Metadata = {
  title: "Premium Software Development Agency",
};

export default function CompanyHome() {
  return (
    <>
      <Hero />
      <About />
      <Services />
      <WhyChooseUs />
      <Process />
      <Technologies />
    </>
  );
}
