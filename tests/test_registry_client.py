"""Tests for RegistryClient and owner confidence enrichment."""

from leadmachine.enrichment.registry_client import RegistryClient


def test_infer_owner_from_jdg_name():
    client = RegistryClient()

    # Typical Polish JDG names with owner's first and last name
    res1 = client.lookup(company_name="Kancelaria Prawna Tomasz Wiśniewski")
    assert res1.owner_name == "Tomasz Wiśniewski"
    assert res1.owner_confidence == "medium"
    assert res1.owner_role == "Właściciel"

    res2 = client.lookup(company_name="Centrum Medyczne Anna Kowalska")
    assert res2.owner_name == "Anna Kowalska"
    assert res2.owner_confidence == "medium"


def test_parse_krs_response():
    client = RegistryClient()

    sample_krs_payload = {
        "odpis": {
            "naglowekA": {"numerKRS": "0001200066"},
            "dane": {
                "dzial1": {
                    "danePodmiotu": {
                        "nazwa": "AM PROCENT SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
                        "identyfikatory": {"nip": "6912590158", "regon": "528000111"},
                    }
                },
                "dzial2": {
                    "organReprezentacji": {
                        "sklad": [
                            {
                                "nazwisko": {"nazwiskoIczlon": "Kowalski"},
                                "imiona": {"imie": "Jan"},
                                "funkcjaWorganie": "Prezes Zarządu",
                            }
                        ]
                    }
                },
            },
        }
    }

    result = client._parse_krs_response(sample_krs_payload)
    assert result.company_legal_name == "AM PROCENT SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ"
    assert result.krs == "0001200066"
    assert result.nip == "6912590158"
    assert result.owner_name == "Jan Kowalski"
    assert result.owner_role == "Prezes Zarządu"
    assert result.owner_confidence == "high"
    assert result.source == "krs_api"
