import { text } from "../core/i18n.js";
import { icon } from '../ui/icons.js';

/** Informational pricing page; no subscriptions are created or billed here. */
export function pricingPage() {
  const features = items => items.map(item => `<li>${icon('check-circle', 17)}<span>${item}</span></li>`).join('');
  const tiers = [
    {
      name: text("pricing.free.name"), badge: text("pricing.free.badge"), price: text("pricing.free.price"),
      description: text("pricing.free.description"),
      benefits: [text("pricing.free.browse"), text("pricing.free.share"), text("home.hero.proof.account")],
      action: text("pricing.free.action"), href: '/explore?free=1', featured: false,
    },
    {
      name: text("pricing.perTemplate.name"), badge: text("pricing.perTemplate.badge"), price: text("pricing.perTemplate.price"),
      description: text("pricing.perTemplate.description"),
      benefits: [text("pricing.perTemplate.previewPrice"), text("pricing.perTemplate.license"), text("pricing.perTemplate.receipt")],
      action: text("pricing.perTemplate.action"), href: '/explore', featured: true,
    },
    {
      name: text("pricing.pro.name"), badge: text("pricing.pro.badge"), price: text("pricing.pro.price"),
      description: text("pricing.pro.description"),
      benefits: [text("pricing.pro.analytics"), text("pricing.pro.branding"), text("pricing.pro.trial")],
      action: text("pricing.pro.action"), href: '/creator', featured: false,
    },
  ];
  return `<section class="section section--cream pricing-page"><div class="container">
    <div class="pricing-intro"><span class="eyebrow eyebrow--outlined">${text("pricing.intro.badge")}</span>
      <h1>${text("pricing.intro.title")}<br><em>${text("pricing.intro.emphasis")}</em></h1>
      <p>${text("pricing.intro.body")}</p>
    </div>
    <p class="pricing-disclaimer" role="note"><strong>${text("pricing.notice.label")}</strong> ${text("pricing.notice.body")}</p>
    <div class="pricing-grid">${tiers.map(tier => `<article class="pricing-card${tier.featured ? ' pricing-card--featured' : ''}">
      <span class="pricing-card__badge">${tier.badge}</span><h2>${tier.name}</h2>
      <p class="pricing-card__price">${tier.price}</p><p class="pricing-card__desc">${tier.description}</p>
      <ul>${features(tier.benefits)}</ul><a href="${tier.href}" data-link class="btn ${tier.featured ? 'btn--dark' : 'btn--outline'}">${tier.action} ${icon('arrow', 17)}</a>
    </article>`).join('')}</div>
    <div class="pricing-faq"><h2>${text("pricing.faq.title")}</h2>
      <details><summary>${text("pricing.faq.subscription.question")}</summary><p>${text("pricing.faq.subscription.answer")}</p></details>
      <details><summary>${text("pricing.faq.trial.question")}</summary><p>${text("pricing.faq.trial.answer")}</p></details>
      <details><summary>${text("pricing.faq.receipt.question")}</summary><p>${text("pricing.faq.receipt.answer")}</p></details>
    </div>
  </div></section>`;
}
