/* The top of the member's page: a welcome ("Hi, Kaushal"), the gym's name and a line of useful info, over the gym's
 * photo when it has one. It replaces the header bar, so the page starts with a greeting instead of a logo row. */
import type { ReactNode } from "react";
import { HeroSlides } from "../../components/ui/HeroSlides.tsx";

/** The member page keeps one photo still (the home screens rotate them). */
const MEMBER_HERO_PHOTO = "gym-dark";

interface Props {
  firstName: string;
  gymName?: string;
  /** Short facts under the gym name, such as the address and the member's batch. */
  info?: string[];
  /** A gym switcher for people who belong to more than one gym. */
  switcher?: ReactNode;
}

export function GymHero({ firstName, gymName, info = [], switcher }: Props) {
  return (
    <section className="gym-hero">
      <HeroSlides still={MEMBER_HERO_PHOTO} />
      {switcher && <div className="gym-hero__switch">{switcher}</div>}
      <h1>
        Hi, <em>{firstName}</em>
      </h1>
      {gymName && <p className="gym-hero__gym">{gymName}</p>}
      {info.length > 0 && <p className="gym-hero__info">{info.join(" · ")}</p>}
    </section>
  );
}
