import json
import pathlib
import unittest

from fletch_webhook import sign_webhook_body, verify_fletch_signature

VECTORS = json.loads((pathlib.Path(__file__).resolve().parent.parent / "fixtures" / "vectors.json").read_text("utf-8"))["vectors"]


class VectorTests(unittest.TestCase):
    def test_vectors(self) -> None:
        for vector in VECTORS:
            with self.subTest(vector["name"]):
                result = verify_fletch_signature(
                    vector["secret"],
                    vector["header"],
                    vector["body"].encode("utf-8"),
                    tolerance_seconds=vector["toleranceSeconds"],
                    now=vector["now"],
                )
                self.assertEqual(result, vector["valid"], vector["reason"])

    def test_sign_round_trip(self) -> None:
        header = sign_webhook_body("whsec_test", '{"id":"dl_1"}', 1789200000)
        self.assertTrue(verify_fletch_signature("whsec_test", header, b'{"id":"dl_1"}', now=1789200010))
        self.assertFalse(verify_fletch_signature("whsec_test", header, b'{"id":"dl_2"}', now=1789200010))

    def test_str_and_bytes_agree(self) -> None:
        body = '{"symbol":"AAPL","note":"€"}'
        header = sign_webhook_body("whsec_test", body.encode("utf-8"), 1789200000)
        self.assertTrue(verify_fletch_signature("whsec_test", header, body, now=1789200000))


if __name__ == "__main__":
    unittest.main()
