import { attr, text } from "../core/i18n.js";
import { templatePreviewDialog } from "../features/catalog/template-preview.js";
import { selectFeaturedTemplates } from '../features/marketing/featured-carousel.js';
import { heroImages, heroSelectors } from '../features/marketing/hero-templates.js';
import { canonicalText } from "../shared/locale.js";
import { icon } from "../ui/icons.js";
import { occasionExploreUrl, occasionShortcuts } from '../features/marketing/occasion-shortcuts.js';
import { renderSeasonBanner } from '../features/marketing/season-campaign.js';
import { templateCardType } from '../shared/card-type.js';

// The covers and player use the same public, built-in templates.
export const homeDemo = {
  id: "snowglobe-countdown",
  creator: "Momevia Originals",
  title: canonicalText("templates.snowglobe-countdown.title"),
};
export const homeDemos = [homeDemo, ...['candle-wish-box','tassel-lift','coffee-catchup','sealed-garden'].map(id => ({
  id, creator: 'Momevia Originals', systemOwned:true, title: canonicalText(`templates.${id}.title`),
}))];

// Only select records supplied by Catalog once it has loaded; keep the complete
// record so preview and creation retain a Creator version or server policy.
export function selectHomeDemos(templates = []) {
  if (!templates.length) return homeDemos;
  const chosen=[];
  const add=template=>{if(template&&!chosen.some(t=>t.id===template.id)&&chosen.length<5)chosen.push(template);};
  add(templates.find(t=>t.id==='snowglobe-countdown') || templates.find(t=>templateCardType(t)==='invitation'));
  for(const id of ['candle-wish-box','tassel-lift','coffee-catchup','sealed-garden'])add(templates.find(t=>t.id===id));
  templates.forEach(add);
  return chosen;
}

export function createHomeViews({ state, buttonLink, templateCard }) {
  function hero() {
    const demos = selectHomeDemos(state.templates);
    return `<section class="hero hero--split mkt-hero open-me-hero moments-hero" data-enter><div class="container wrap">
      ${renderSeasonBanner()}
      <div class="hero-text mkt-hero__layout">
      <div class="mkt-hero__intro">
        <span class="open-me-intro-sheen" aria-hidden="true"></span>
        <span class="mkt-hero__eyebrow">${icon("sparkles", 17)} ${text("home.openMe.eyebrow")}</span>
        <h1>${text("home.openMe.title")}<br><em>${text("home.openMe.emphasis")}</em></h1>
        <p class="hero__lead">${text("home.openMe.description")}</p>
        <div class="mkt-actions">
          <button type="button" class="btn mkt-primary" data-home-create aria-haspopup="dialog">${text("home.openMe.create")}</button>
          ${buttonLink("/explore", text("home.openMe.browse"), "mkt-secondary")}
        </div>
        <ul class="mkt-hero__benefits">
          <li>${icon("check-circle", 17)} ${text("home.hero.proof.design")}</li>
          <li>${icon("check-circle", 17)} ${text("home.hero.proof.account")}</li>
        </ul>
        <a class="mkt-hero__scroll" href="#how-it-works">${text("home.hero.how")} ${icon("chevron-down", 17)}</a>
      </div>
      <div class="mkt-hero__artwork open-me-hero__showcase">
      <div class="mkt-hero__frame mkt-stage open-me-stack" data-visual data-enter-media data-mkt-tilt data-mkt-tilt-strength="0.15">
        <div class="mkt-stage__atmosphere" aria-hidden="true"><span class="mkt-stage__orb mkt-stage__orb--first"></span><span class="mkt-stage__orb mkt-stage__orb--second"></span><span class="mkt-stage__ring"></span><span class="mkt-stage__envelope"></span></div>
        <span class="open-me-posters__stamp" aria-hidden="true">${text('home.openMe.stamp')}</span>
        <div class="mkt-stage__note" aria-hidden="true"><span>${text('home.hero.note.caption')}</span><strong>${text('home.hero.note.title')}</strong></div>
        <div class="mkt-stage__cards"><button type="button" class="mkt-hero__cover" data-template-preview aria-haspopup="dialog" ${attr('aria-label','home.hero.preview')}>${heroImages(demos)}</button></div>
        <div class="mkt-stage__reply" aria-hidden="true"><span>${text('home.hero.reply.caption')}</span><strong>${icon('heart',15)} ${text('home.hero.reply.title')}</strong></div>
      </div>
      <div class="mkt-hero__rotation open-me-hero__controls" role="group" ${attr('aria-label','home.hero.slides')}>
        <button type="button"
          class="mkt-hero__playback"
          data-hero-playback
          hidden
        >${text('home.hero.pauseSlides')}</button>
        ${heroSelectors(demos)}
      </div>
      </div>
      </div>
      ${templatePreviewDialog(demos[0])}
      <dialog class="home-create-dialog" aria-labelledby="home-create-title">
        <div class="home-create-dialog__heading"><h2 id="home-create-title">${text('home.openMe.choose')}</h2><button type="button" class="icon-button" data-home-create-close ${attr('aria-label','common.actions.close')}>${icon('close', 22)}</button></div>
        <p>${text('home.openMe.chooseHint')}</p>
        <div class="home-create-dialog__choices">${['invitation','greeting'].map(type => `<a href="/explore?cardType=${type}" data-link class="home-create-choice home-create-choice--${type}">${icon(type === 'invitation' ? 'calendar' : 'heart', 28)}<strong>${text(`home.openMe.${type}`)}</strong><span>${text(`home.openMe.${type}Hint`)}</span>${icon('arrow', 20)}</a>`).join('')}</div>
        <a href="/design/new" data-link class="home-create-dialog__blank">${text('home.openMe.blank')} ${icon('arrow', 16)}</a>
      </dialog>
    </div></section>`;
  }

  function occasionBrowse() {
    const options = occasionShortcuts(state.templates);
    if (!options.length) return '';
    return `<nav class="mkt-occasion" ${attr('aria-label', 'home.featured.occasionBrowse')}>
      <div class="mkt-occasion__links">${options.map(({ value, labelKey, count }) => `<a class="mkt-occasion__link" href="${occasionExploreUrl(value)}" data-link ${attr('aria-label', 'home.featured.occasionAction', { category: { format: 'message', key: labelKey }, count })}>
        <span class="mkt-occasion__name">${text(labelKey)}</span>
        <span class="mkt-occasion__count" aria-hidden="true">${count}</span>
        ${icon('arrow', 16)}
      </a>`).join('')}</div>
    </nav>`;
  }

  function featuredGifts(status) {
    if (status === "loading") return `<p role="status">${text("home.featured.loading")}</p>`;
    if (status === "error") return `<p role="alert">${text("home.featured.error")}</p>
      <button class="btn mkt-secondary" type="button" data-home-catalog-retry>${text("common.actions.retry")}</button>`;
    const selections=selectFeaturedTemplates(state.templates);
    return selections.length
      ? `${occasionBrowse()}<div class="featured-carousel" data-featured-carousel data-featured-count="${selections.length}" role="group" ${attr('aria-label','home.featured.title')}><div class="featured-carousel__viewport" data-featured-viewport><div class="mkt-gift-grid featured-carousel__track" data-featured-track data-visual>${selections.map(template=>templateCard(template,{compact:true})).join('')}</div></div></div>`
      : `<p role="status">${text("home.featured.empty")}</p>`;
  }

  function steps() {
    return `<section id="how-it-works" class="mkt-section mkt-how" data-mkt-reveal aria-labelledby="mkt-experience-title" data-moment="liquid-type" data-moment-opts='{"strength": 0.35}'><div class="container wrap">
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

  function journey() {
    const steps = [
      { id: 'create', symbol: 'pencil' },
      { id: 'share', symbol: 'send' },
      { id: 'open', symbol: 'gift' },
      { id: 'reply', symbol: 'message-circle' },
      { id: 'keep', symbol: 'bookmark' },
    ];
    return `<section class="mkt-section mkt-journey" data-mkt-journey data-mkt-reveal aria-labelledby="mkt-journey-title">
      <div class="container wrap mkt-journey__layout">
        <div class="mkt-journey__heading">
          <span class="mkt-journey__eyebrow">${text("home.journey.eyebrow")}</span>
          <h2 id="mkt-journey-title">${text("home.journey.title")}</h2>
          <p>${text("home.journey.intro")}</p>
        </div>
        <p id="mkt-journey-keyboard-hint" class="visually-hidden">${text("home.journey.keyboardHint")}</p>
        <div class="mkt-journey__steps" role="group" aria-describedby="mkt-journey-keyboard-hint" ${attr("aria-label", "home.journey.stepsLabel")}>
          ${steps.map(({ id, symbol }, index) => `<button type="button" class="mkt-journey__step" data-mkt-step="${id}" aria-pressed="${id === 'create'}" aria-controls="mkt-journey-panel-${id}">
            <span class="mkt-journey__step-index">0${index + 1}</span>
            ${icon(symbol, 21)}
            <span class="mkt-journey__step-label">${text(`home.journey.${id}.title`)}</span>
          </button>`).join('')}
        </div>
        <div class="mkt-journey__showcase">
          <div class="mkt-journey__scene" data-mkt-journey-scene data-stage="create" data-gift-open="false" aria-hidden="true">
            <div class="mkt-journey__halo"></div>
            <div class="mkt-journey__orbit mkt-journey__orbit--first"></div>
            <div class="mkt-journey__orbit mkt-journey__orbit--second"></div>
            <div class="mkt-journey__postcard">
              <div class="mkt-journey__face mkt-journey__face--front">
                <span class="mkt-journey__stamp">${icon('heart', 25)}</span>
                <strong>${text("home.journey.scene.front")}</strong>
                <span>${text("home.journey.scene.subtitle")}</span>
              </div>
              <div class="mkt-journey__face mkt-journey__face--back">
                <span class="mkt-journey__stamp">${icon('message-circle', 25)}</span>
                <strong>${text("home.journey.scene.back")}</strong>
                <span>${text("home.journey.scene.reply")}</span>
              </div>
            </div>
            <div class="mkt-journey__gift" aria-hidden="true">
              <div class="mkt-journey__gift-base"></div>
              <div class="mkt-journey__gift-lid">${icon('gift', 32)}</div>
            </div>
            <span class="mkt-journey__spark mkt-journey__spark--one"></span>
            <span class="mkt-journey__spark mkt-journey__spark--two"></span>
          </div>
          <div class="mkt-journey__details" aria-live="polite" aria-atomic="true">
            ${steps.map(({ id }) => `<div id="mkt-journey-panel-${id}" data-mkt-panel="${id}" ${id === 'create' ? '' : 'hidden'}>
              <h3>${text(`home.journey.${id}.title`)}</h3>
              <p>${text(`home.journey.${id}.body`)}</p>
              ${id === 'open' ? `<div class="mkt-journey__gift-controls">
                <button type="button" class="btn mkt-primary mkt-journey__gift-toggle" data-mkt-gift-toggle aria-expanded="false" aria-controls="mkt-journey-gift-message">
                  ${icon('gift', 18)}<span data-mkt-gift-label-closed>${text('home.journey.gift.open')}</span><span data-mkt-gift-label-open hidden>${text('home.journey.gift.close')}</span>
                </button>
                <div id="mkt-journey-gift-message" class="mkt-journey__gift-next" data-mkt-gift-message hidden>
                  <p>${text('home.journey.gift.message')}</p>
                  <button type="button" class="btn mkt-primary mkt-journey__gift-create" data-home-create-after-demo aria-haspopup="dialog">${text('home.journey.gift.create')} ${icon('arrow-up-right', 18)}</button>
                </div>
              </div>` : ''}
            </div>`).join('')}
          </div>
          <p class="mkt-journey__swipe-hint">${text('home.journey.swipeHint')}</p>
        </div>
        <div class="mkt-journey__footer">${buttonLink('/explore', text('home.journey.cta'), 'mkt-primary')}</div>
      </div>
    </section>`;
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
      <section class="mkt-section mkt-featured" aria-labelledby="mkt-featured-title" data-mkt-reveal><div class="container wrap">
        <div class="mkt-featured__heading"><h2 id="mkt-featured-title">${text("home.featured.title")}</h2>
        ${buttonLink("/explore", text("home.featured.all"), "mkt-secondary")}</div>
        <div id="home-featured-gifts">${featuredGifts(catalogStatus)}</div>
      </div></section>
      ${journey()}
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
