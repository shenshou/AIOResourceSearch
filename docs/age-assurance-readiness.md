# Age-assurance readiness

**Status: launch blocker for adult-content discovery**

This document records the project's technical and policy assessment. It is an engineering decision record, not legal advice or a determination that any particular statute applies to this project.

## Scope

The product is a public search aggregator. It can expose adult-source names, search destinations, metadata, and outbound links even though it does not host video files. The absence of media hosting does not by itself establish that age-assurance rules are inapplicable. Whether a particular law covers this service depends on its statutory definitions, the actual content presented, the operator's status, the service's commercial character, and the jurisdictions served.

The project has not completed a jurisdiction-by-jurisdiction legal applicability review. Do not infer that a rule does or does not apply solely from the fact that the project is a small, non-monetized, public GitHub Pages/Cloudflare application.

## Evidence reviewed (2026-11-26)

### United States

- The Free Speech Coalition's FAQ, updated 2026-07-08, tracks 27 states with age-verification requirements for adult websites and explains that scope commonly turns on whether a substantial portion of the service presents material harmful to minors. It is an industry tracker, not a substitute for each current statute or court order: https://www.freespeechcoalition.com/faq
- Arizona Revised Statutes §18-701 requires a covered commercial entity to use reasonable age verification when more than one-third of the website's material is sexual material harmful to minors. It specifies digital identification or a commercial age-verification system based on government-issued identification or public/private transactional data, and restricts retention/transmission of identifying information: https://www.azleg.gov/ars/18/00701.htm
- Missouri Revised Statutes §407.3405, effective 2026-08-28, defines age verification using digital identification or a commercial system relying on government ID or public/private transactional data: https://www.revisor.mo.gov/main/OneSection.aspx?section=407.3405
- Utah's Department of Commerce announced that enforcement of the core age-verification requirement for covered commercial adult websites began 2026-11-02. The same notice distinguishes the age-verification mandate from a separately enjoined location/VPN provision: https://commerce.utah.gov/2026/10/30/utah-to-begin-enforcing-age-verification-for-adult-websites/
- The U.S. Supreme Court held in *Free Speech Coalition, Inc. v. Paxton* (2025) that Texas's age-verification law was a constitutionally permissible exercise of state authority: https://www.supremecourt.gov/opinions/24pdf/23-1122_3e04.pdf

The statutes differ. This project must not treat one state's method, threshold, exemptions, or data rules as a nationwide standard.

### European Union

- The Commission's DSA guidance recommends effective age assurance and age verification for high-risk services such as adult content: https://digital-strategy.ec.europa.eu/en/policies/dsa-impact-platforms
- Commission Recommendation (EU) 2026/1035 sets a common framework for privacy-preserving age-verification technologies. It emphasizes selective disclosure, limiting the relying party's result to the age threshold, and safeguards against tracking: https://eur-lex.europa.eu/eli/reco/2026/1035/oj
- The Commission's technical manual describes the EU Age Verification Blueprint, its open-source implementation, attestation/trust model, and verification of trusted issuers: https://ec.europa.eu/digital-building-blocks/sites/pages/viewpage.action?pageId=930452138
- The blueprint's reference implementation is free/open source, but a relying service still needs a supported issuer ecosystem and trusted-list validation. Merely self-hosting the verifier does not create trusted age credentials: https://docs.ageverification.dev/av-doc-technical-specification/docs/architecture-and-technical-specifications/

## Options considered

| Option | Cost | Assurance | Decision |
|---|---|---|---|
| DOB field / 18+ checkbox / localStorage flag | No direct cost | Self-declaration only; easily bypassed and not a substitute for statutory age verification | Reject as compliance control |
| Build an in-house verifier from scratch | Engineering and operational cost; no trustworthy data source by itself | Cannot establish age without reliable evidence; creates sensitive-data and security risks if it collects IDs or payment/identity data | Reject |
| Use a trusted age-assurance provider | May involve fees and jurisdiction-specific contracts | Potentially suitable where the provider/method meets the relevant law | Not selected; conflicts with current no-paid-service constraint unless a genuinely free trusted option is available |
| Integrate the EU Age Verification Blueprint | Software is open source/free | Privacy-preserving proof of age, but depends on trusted issuers, supported presentation protocols, and Member State deployment | Keep as a future EU-specific integration candidate; not a universal solution |
| Restrict adult features by jurisdiction | Infrastructure cost may be low, but requires reliable geo-policy and ongoing legal maintenance | May reduce exposure but is not a substitute for verification where the law requires verification; IP geolocation is imperfect | Not approved as the sole control |
| Keep adult discovery unavailable | No verification vendor cost | Avoids presenting adult search results through this product while the gate is unresolved | **Selected interim state** |

## Engineering decision

1. Do not implement a cosmetic age gate and label it age verification.
2. Keep adult-only Providers disabled and unconfigured.
3. Until a reviewed age-assurance path is operational, do not display adult search results, adult metadata, adult-source external-search destinations, or adult source links in the public interface. Hiding only thumbnails is insufficient.
4. Do not collect or retain government IDs, selfies, face templates, dates of birth, payment data, or identity documents in this project.
5. Do not store a reusable "verified" boolean in localStorage or treat a browser cookie as proof of age.
6. Keep non-adult categories and sources independent; do not gate unrelated categories merely because adult sources exist in the catalog.
7. Before enabling adult discovery, document launch jurisdictions, applicable statutory thresholds/exemptions, whether this service is covered, acceptable proof methods, privacy/data-retention obligations, and the operational process for verification failures and appeals.
8. If a no-cost, trusted, privacy-preserving method is not available for the selected launch scope, adult discovery remains disabled. Do not bypass the requirement by relabeling the service or routing users through third-party sites.

## Reconsideration criteria

Reopen this decision only when at least one of the following is true:

- A trusted, no-cost age-assurance mechanism is available for the project's actual launch jurisdictions and the project can validate its trust chain.
- The operator obtains an appropriately scoped, reviewed age-assurance provider arrangement.
- The product scope changes so adult discovery and adult-source navigation are removed from the public service.

Any future implementation must be server-enforced for protected API results, fail closed when proof validation or trust-list checks fail, minimize retained state, and include tests for expired, replayed, malformed, wrong-audience, wrong-threshold, and untrusted-issuer proofs.
