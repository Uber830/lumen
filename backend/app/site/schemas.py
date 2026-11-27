"""Pydantic models for the public site.

Two layers:

- `SiteDocument` is the shape of the row stored in `site_content`. It
  is validated when it is read, so a copy edited in the database that
  does not fit the contract fails at the API instead of reaching the
  page half-rendered.
- `SiteResponse` is what the endpoint returns: the copy, the figures
  and the catalog.

The copy of the landing lives entirely in this contract. Nothing is
hardcoded in the frontend: the page renders what the API sends.
"""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field

# The lifecycle of a catalog piece, as it is shown in the index.
CatalogState = Literal["published", "review", "draft", "archived"]

# The three button variants of the design.
ActionVariant = Literal["solid", "outline", "accent"]


class LinkContent(BaseModel):
    """A link inside the navigation, the footer or a call to action."""

    id: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=120)
    href: str = Field(min_length=1, max_length=500)


class ActionContent(LinkContent):
    """A link that is drawn as a button."""

    variant: ActionVariant = "solid"


class NavContent(BaseModel):
    """The header of the public site."""

    links: list[LinkContent] = Field(default_factory=list)
    login_label: str = Field(min_length=1, max_length=60)
    contact_label: str = Field(min_length=1, max_length=60)


class HeroContent(BaseModel):
    """The opening block of the landing.

    The title is two sentences: the first in ink, the second in the
    accent colour. They are separate fields because that split is the
    signature of the cover.
    """

    kicker: str = Field(min_length=1, max_length=120)
    title_lead: str = Field(min_length=1, max_length=200)
    title_tail: str = Field(min_length=1, max_length=200)
    lead: str = Field(min_length=1, max_length=600)
    cta_primary: ActionContent
    cta_secondary: ActionContent


class StatItem(BaseModel):
    """One figure of the hero."""

    label: str = Field(min_length=1, max_length=60)
    value: str = Field(min_length=1, max_length=40)


class ColumnContent(BaseModel):
    """One column of the catalog table."""

    id: str = Field(min_length=1, max_length=64)
    label: str = Field(min_length=1, max_length=120)


class CatalogContent(BaseModel):
    """The header of the catalog index."""

    kicker: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    lead: str = Field(min_length=1, max_length=600)
    columns: list[ColumnContent] = Field(default_factory=list)
    # The footer of the table: "{prefix} {shown} de {total} {suffix}".
    footer_prefix: str = Field(default="Mostrando", max_length=60)
    footer_suffix: str = Field(default="entradas", max_length=200)


class ProcessStep(BaseModel):
    """One step of the process."""

    number: str = Field(min_length=1, max_length=8)
    title: str = Field(min_length=1, max_length=200)
    body: str = Field(min_length=1, max_length=600)
    owner: str = Field(min_length=1, max_length=120)


class ProcessContent(BaseModel):
    """The process block of the landing."""

    kicker: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    steps: list[ProcessStep] = Field(default_factory=list)


class RoleItem(BaseModel):
    """One role of the platform."""

    id: str = Field(min_length=1, max_length=60)
    summary: str = Field(min_length=1, max_length=200)
    detail: str = Field(min_length=1, max_length=600)
    scope: str = Field(min_length=1, max_length=200)


class RolesContent(BaseModel):
    """The roles block of the landing."""

    kicker: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    items: list[RoleItem] = Field(default_factory=list)


class CoverageItem(BaseModel):
    """One feature of a coverage row.

    `included` marks the features that come with the plan; the rest are
    listed as not included.
    """

    label: str = Field(min_length=1, max_length=120)
    included: bool = True


class CoverageRow(BaseModel):
    """One school size."""

    id: str = Field(min_length=1, max_length=60)
    label: str = Field(min_length=1, max_length=60)
    size: str = Field(min_length=1, max_length=60)
    items: list[CoverageItem] = Field(default_factory=list)


class CoverageContent(BaseModel):
    """The coverage block of the landing."""

    kicker: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    lead: str = Field(default="", max_length=600)
    rows: list[CoverageRow] = Field(default_factory=list)


class FaqItem(BaseModel):
    """One question of the FAQ."""

    id: str = Field(min_length=1, max_length=16)
    question: str = Field(min_length=1, max_length=300)
    answer: str = Field(min_length=1, max_length=1200)


class FaqContent(BaseModel):
    """The questions block of the landing."""

    kicker: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=200)
    items: list[FaqItem] = Field(default_factory=list)


class SpecRow(BaseModel):
    """One row of a spec panel."""

    label: str = Field(min_length=1, max_length=60)
    value: str = Field(min_length=1, max_length=300)


class CtaContent(BaseModel):
    """The closing call to action."""

    kicker: str = Field(min_length=1, max_length=120)
    title: str = Field(min_length=1, max_length=300)
    body: str = Field(min_length=1, max_length=800)
    buttons: list[ActionContent] = Field(default_factory=list)
    spec: list[SpecRow] = Field(default_factory=list)


class FooterColumn(BaseModel):
    """One column of links in the footer."""

    title: str = Field(min_length=1, max_length=60)
    links: list[LinkContent] = Field(default_factory=list)


class FooterContent(BaseModel):
    """The footer of the public site."""

    brand: str = Field(min_length=1, max_length=120)
    location: str = Field(min_length=1, max_length=120)
    columns: list[FooterColumn] = Field(default_factory=list)
    legal: str = Field(min_length=1, max_length=400)


class SiteCopy(BaseModel):
    """The copy of the landing, section by section.

    The blocks that are not published are simply not in the copy: the
    coverage by school size is optional, for instance, and the page
    draws it only when the copy carries it.
    """

    nav: NavContent
    hero: HeroContent
    catalog: CatalogContent
    process: ProcessContent
    roles: RolesContent
    coverage: CoverageContent | None = None
    faq: FaqContent
    cta: CtaContent
    footer: FooterContent


class SiteDocument(SiteCopy):
    """The row stored in `site_content`.

    It carries the copy plus the figures and the contact address, so
    the platform team edits the whole page in one place.
    """

    stats: list[StatItem] = Field(default_factory=list)
    contact_email: str = Field(min_length=3, max_length=200)


class CatalogEntry(BaseModel):
    """One row of the catalog index, as the page shows it."""

    ref: str
    title: str
    meta: str | None = None
    area: str
    # Up to two school names; the rest is counted in `schools_extra`.
    schools: list[str] = Field(default_factory=list)
    schools_extra: int = 0
    state: CatalogState


class SiteResponse(BaseModel):
    """The response of GET /v1/public/site."""

    stats: list[StatItem] = Field(default_factory=list)
    catalog: list[CatalogEntry] = Field(default_factory=list)
    catalog_total: int = 0
    contact_email: str
    content: SiteCopy


__all__ = [
    "ActionContent",
    "ActionVariant",
    "CatalogContent",
    "CatalogEntry",
    "CatalogState",
    "ColumnContent",
    "CoverageContent",
    "CoverageItem",
    "CoverageRow",
    "CtaContent",
    "FaqContent",
    "FaqItem",
    "FooterColumn",
    "FooterContent",
    "HeroContent",
    "LinkContent",
    "NavContent",
    "ProcessContent",
    "ProcessStep",
    "RolesContent",
    "RoleItem",
    "SiteCopy",
    "SiteDocument",
    "SiteResponse",
    "SpecRow",
    "StatItem",
]
