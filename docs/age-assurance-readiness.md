# Age-assurance and launch-scope readiness

**Status: jurisdiction-specific launch assessment pending; no blanket adult-content disablement**

This document records the project's technical and policy assessment. It is an engineering decision record, not legal advice or a determination that any particular statute applies to this project.

## Product scope

AIOResourceSearch is a multi-category metadata search aggregator. Adult-resource discovery is one of the product's core use cases. The project does not host or stream media files; it may display source names, text metadata, resource identifiers, and user-opened external links.

The absence of media hosting does not by itself establish that age-assurance rules are inapplicable. Conversely, the project must not assume that every rule governing adult video-hosting services automatically applies to a metadata search aggregator. Applicability depends on statutory definitions, the actual material presented, the operator's status, the service's commercial character, and the jurisdictions served.

The project has not completed a jurisdiction-by-jurisdiction legal applicability review. Do not infer that a rule does or does not apply solely from the fact that the project is small, non-monetized, or hosted on GitHub Pages and Cloudflare.

## Evidence reviewed (2026-11-26)

### United States

- The Free Speech Coalition's FAQ, updated 2026-07-08, tracks 27 states with age-verification requirements for adult websites and explains that scope commonly turns on whether a substantial portion of the service presents material harmful to minors. It is an industry tracker, not a substitute for each current statute or court order: https://www.freespeechcoalition.com/faq
- Arizona Revised Statutes §18-701 requires a covered commercial entity to use reasonable age verification when more than one-third of the website's material is sexual material harmful to minors. It specifies digital identification or a commercial age-verification system based on government-issued identification or public/private transactional data, and restricts retention/transmission of identifying information: https://www.azleg.gov/ars/18/00701.htm
- Missouri Revised Statutes §407.3405, effective 2026-08-28, defines age verification using digital identification or a commercial system relying on government ID or public/private transactional data: https://www.revisor.mo.gov/main/OneSection.aspx?section=407.3405
- Utah's Department of Commerce announced that enforcement of the core age-verification requirement for covered commercial adult websites began 2026-11-02. The same notice distinguishes the age-verification mandate from a separately enjoined location/VPN provision: https://commerce.utah.gov/2026/10/30/utah-to-begin-enforcing-age-verification-for-adult-websites/
- The U.S. Supreme Court held in *Free Speech Coalition, Inc. v. Paxton* (2025) that Texas's age-verification law was a constitutionally permissible exercise of state authority: https://www.supremecourt.gov/opinions/24pdf/23-1122_3e04.pdf

The statutes differ. This project must not treat one state's method, threshold, exemptions, or data rules as a nationwide standard. It must also assess whether the statutory definitions cover this particular metadata-search product rather than assuming that they do.

### European Union

- The Commission's DSA guidance recommends effective age assurance and age verification for high-risk services such as adult content: https://digital-strategy.ec.europa.eu/en/policies/dsa-impact-platforms
- Commission Recommendation (EU) 2026/1035 sets a common framework for privacy-preserving age-verification technologies. It emphasizes selective disclosure, limiting the relying party's result to the age threshold, and safeguards against tracking: https://eur-lex.europa.eu/eli/reco/2026/1035/oj
- The Commission's technical manual describes the EU Age Verification Blueprint, its open-source implementation, attestation/trust model, and verification of trusted issuers: https://ec.europa.eu/digital-building-blocks/sites/pages/viewpage.action?pageId=930452138
- The blueprint's reference implementation is free/open source, but a relying service still needs a supported issuer ecosystem and trusted-list validation. Merely self-hosting the verifier does not create trusted age credentials: https://docs.ageverification.dev/av-doc-technical-specification/docs/architecture-and-technical-specifications/

## Options considered

| Option | Cost | Assurance | Decision |
|---|---|---|---|
| DOB field / 18+ checkbox / localStorage flag | No direct cost | Self-declaration only; easily bypassed and not a substitute for statutory age verification | Reject as a compliance control |
| Build an in-house verifier from scratch | Engineering and operational cost; no trustworthy data source by itself | Cannot establish age without reliable evidence; creates sensitive-data and security risks if it collects IDs or payment/identity data | Reject |
| Use a trusted age-assurance provider | May involve fees and jurisdiction-specific contracts | Potentially suitable where the provider/method meets the relevant law | Not selected; conflicts with the current no-paid-service constraint unless a genuinely free trusted option is available |
| Integrate the EU Age Verification Blueprint | Software is open source/free | Privacy-preserving proof of age, but depends on trusted issuers, supported presentation protocols, and Member State deployment | Keep as a future EU-specific integration candidate; not a universal solution |
| Restrict adult features by jurisdiction | Infrastructure cost may be low, but requires reliable geo-policy and ongoing legal maintenance | May reduce exposure but is not a substitute for verification where the law requires verification; IP geolocation is imperfect | Consider only if a legal review identifies a relevant jurisdiction-specific obligation; not approved as a universal default |
| Hide all adult discovery until a verification vendor is selected | No verification vendor cost | Removes a core product use case without first establishing that this product is covered by the relevant requirements | Rejected as a blanket product rule |

## Engineering and product decision

1. Adult-resource discovery remains a core product capability. Do not globally hide adult categories, metadata, search results, or source destinations solely because the jurisdiction review is incomplete.
2. Do not implement a cosmetic age gate and label it age verification.
3. Continue source-by-source technical and policy review. A source's own Terms, API contract, access controls, attribution rules, and removal requirements remain independently binding project constraints.
4. Before public launch, document the intended launch jurisdictions and assess whether the laws in those jurisdictions cover this metadata-search service, including relevant definitions, thresholds, exemptions, operator status, and service characteristics.
5. If a reviewed jurisdiction-specific obligation applies, implement the required proportionate control for that scope before serving affected users. If no compliant no-cost method is available, evaluate a narrowly scoped jurisdiction or feature restriction, or delay launch in that scope; do not automatically disable adult discovery worldwide.
6. Do not collect or retain government IDs, selfies, face templates, dates of birth, payment data, or identity documents in this project unless a separately reviewed design establishes a lawful necessity and appropriate safeguards. The current design does not collect them.
7. Do not store a reusable "verified" boolean in localStorage or treat a browser cookie as proof of age.
8. Keep non-adult categories independent; adult compliance work must not unnecessarily gate unrelated categories.
9. Worker authorization, input validation, source enablement, rate limiting, and API security remain required regardless of age-assurance decisions. These controls protect the service and do not themselves constitute age verification.

## Reconsideration and launch criteria

Revisit this record when launch jurisdictions are selected, relevant laws or court orders change, or the product's content and operating model materially change. Before release, record the applicability conclusion and any required controls for each launch jurisdiction. If a control is required, validate it server-side and fail closed for the affected scope when proof validation or trust-list checks fail; minimize retained state and test expired, replayed, malformed, wrong-audience, wrong-threshold, and untrusted-issuer proofs.

