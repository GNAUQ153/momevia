import { attr, text } from "../core/i18n.js";
import { templatePreviewDialog } from "../features/catalog/template-preview.js";
import { isInSeason, vietnamDay } from "../features/catalog/seasonal.js";
import { templateCover } from "../features/catalog/template-copy.js";
import { canonicalText } from "../shared/locale.js";
import { icon } from "../ui/icons.js";

// The cover and player both use the same public, built-in template.
export const homeDemo = {
  id: "hai-phong-bi",
  creator: "Momevia Originals",
  title: canonicalText("templates.hai-phong-bi.title"),
};

export function createHomeViews({ state, buttonLink, templateCard }) {
  function hero() {
    return `<section class="hero hero--split mkt-hero" data-enter><div class="container wrap"><div class="hero-text mkt-hero__layout">
      <div class="mkt-hero__intro">
        <h1>${text("home.hero.title")}</h1>
        <p class="hero__lead">${text("home.hero.description")}</p>
        <div class="mkt-actions">
          ${buttonLink("/explore", text("home.hero.cta"), "mkt-primary")}
          <button type="button" class="btn mkt-secondary" data-template-preview aria-haspopup="dialog">${icon("eye", 18)} ${text("home.hero.preview")}</button>
        </div>
      </div>
      <div class="mkt-hero__frame hero__window" data-visual data-enter-media>
        <button type="button" class="mkt-hero__cover" data-template-preview aria-haspopup="dialog" ${attr("aria-label", "home.hero.preview")}>
          <img ${templateCover(homeDemo.id)} alt="" width="390" height="844" fetchpriority="high" />
        </button>
      </div>
      </div>
      ${templatePreviewDialog(homeDemo)}
    </div></section>`;
  }

  function featuredGifts(status) {
    if (status === "loading") return `<p role="status">${text("home.featured.loading")}</p>`;
    if (status === "error") return `<p role="alert">${text("home.featured.error")}</p>
      <button class="btn mkt-secondary" type="button" data-home-catalog-retry>${text("common.actions.retry")}</button>`;
    const day = vietnamDay();
    const ranked = state.templates.slice().sort((a, b) => Number(isInSeason(b, day)) - Number(isInSeason(a, day)) || Number(Boolean(b.featured)) - Number(Boolean(a.featured)));
    const selections = new Map();
    for (const template of ranked) {
      const occasion = template.category || template.style || template.id;
      if (!selections.has(occasion)) selections.set(occasion, template);
      if (selections.size === 3) break;
    }
    return selections.size
      ? `<div class="mkt-gift-grid" data-visual>${[...selections.values()].map(template => templateCard(template, { compact: true })).join("")}</div>`
      : `<p role="status">${text("home.featured.empty")}</p>`;
  }

  function steps() {
    return `<section id="how-it-works" class="mkt-section mkt-how" aria-labelledby="mkt-experience-title" data-moment="liquid-type" data-moment-opts='{"strength": 0.35}'><div class="container wrap">
      <h2 id="mkt-experience-title" class="mo-lt__type">${text("home.steps.heading")}</h2>
      <div class="mkt-how__body">
        <ol class="mkt-steps">${["choose", "personalize", "send"].map((step, index) => `<li>
          <span class="mkt-step-number" aria-hidden="true">0${index + 1}</span>
          <div><h3>${text(`home.steps.${step}.title`)}</h3><p>${text(`home.steps.${step}.body`)}</p></div>
        </li>`).join("")}</ol>
        <div class="mkt-example app-frame" data-visual>
          <div class="mkt-example__editor">
            <h3>${icon("pencil", 17)} ${text("home.steps.editor")}</h3>
            <div class="mkt-example__field"><strong>${text("home.steps.personalize.title")}</strong><p>${text("home.steps.greeting")}</p></div>
          </div>
          <div class="mkt-example__recipient">
            <h3>${icon("gift", 17)} ${text("home.steps.gift")}</h3>
            <div class="mkt-example__letter"><span>${text("home.steps.recipient")}</span><p>${text("home.steps.greeting")}</p></div>
          </div>
        </div>
      </div>
    </div></section>`;
  }

  function marketingFaq() {
    return `<h2 id="mkt-faq-title">${text("home.faq.title")}</h2>
      <div class="mkt-faq">
      <div class="mkt-faq__items">${["design", "account", "free", "payment"].map(key => `<details class="mkt-faq__item">
        <summary>${text(`home.faq.${key}.question`)} ${icon("chevron-down", 20)}</summary>
        <p>${text(`home.faq.${key}.answer`)}</p>
      </details>`).join("")}</div>
      <div class="mkt-faq__callout">
        ${buttonLink("/explore", text("home.hero.cta"), "mkt-primary")}
        ${buttonLink("/pricing", text("home.faq.pricing"), "mkt-secondary", false)}
      </div>
    </div>`;
  }

  function home({ catalogStatus = "ready" } = {}) {
    return `${hero()}
      <section class="mkt-section mkt-featured" aria-labelledby="mkt-featured-title"><div class="container wrap">
        <div class="mkt-featured__heading"><h2 id="mkt-featured-title">${text("home.featured.title")}</h2>
        ${buttonLink("/explore", text("home.featured.all"), "mkt-secondary")}</div>
        <div id="home-featured-gifts">${featuredGifts(catalogStatus)}</div>
      </div></section>
      ${steps()}`;
  }


  function aboutPage() {
    const values = [
      {
        icon: "heart",
        title: text("home.about.personal.title"),
        description:
          text("home.about.personal.body"),
      },
      {
        icon: "gift",
        title: text("home.about.experience.title"),
        description:
          text("home.about.experience.body"),
      },
      {
        icon: "shield",
        title: text("home.about.privacy.title"),
        description:
          text("home.about.privacy.body"),
      },
    ];
    return `<section class="about-hero"><div class="container about-hero__inner">
      <span class="eyebrow eyebrow--outlined">${text("home.about.badge")}</span>
      <h1>${text("home.about.title")}<br><em>${text("home.about.emphasis")}</em></h1>
      <p>${text("home.about.intro")}</p>
      ${buttonLink("/explore", text("home.about.explore"))}
    </div></section>
    <section class="section section--white"><div class="container">
      <div class="section-heading section-heading--center"><span class="eyebrow">${text("home.about.values.badge")}</span><h2>${text("home.about.values.title")} <em>${text("home.about.values.emphasis")}</em></h2><p>${text("home.about.values.body")}</p></div>
      <div class="about-values">${values.map((value) => `<article class="about-value"><span class="about-value__icon">${icon(value.icon, 25)}</span><h2>${value.title}</h2><p>${value.description}</p></article>`).join("")}</div>
    </div></section>
    <section class="section section--cream"><div class="container about-story">
      <div><span class="eyebrow">${text("home.about.story.badge")}</span><h2>${text("home.about.story.title")}<br><em>${text("home.about.story.emphasis")}</em></h2><p>${text("home.about.story.body")}</p><p>${text("home.about.story.roadmap")}</p></div>
      <div class="about-story__card"><strong>${text("home.about.story.quote")}</strong><span>${text("home.about.story.byline")}</span></div>
    </div></section>
    <section class="section section--white"><div class="container about-cta"><h2>${text("home.about.closing.title")} <em>${text("home.about.closing.emphasis")}</em></h2><p>${text("home.about.closing.body")}</p>${buttonLink("/explore", text("home.about.closing.action"))}</div></section>`;
  }

  return { home, featuredGifts, marketingFaq, aboutPage };
}
