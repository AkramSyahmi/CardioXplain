# The shown percent must never contradict the risk category (final styling review, Important 2).
from ml.features import risk_category, risk_percent


def test_percent_rounds_down_so_it_matches_the_category():
    assert risk_percent(0.3951) == 39
    assert risk_category(0.3951) == "Low"
    assert risk_percent(0.6951) == 69
    assert risk_category(0.6951) == "Moderate"


def test_exact_values_survive_float_noise():
    assert risk_percent(0.29) == 29  # 0.29 * 100 = 28.999999999999996
    assert risk_percent(0.40) == 40
    assert risk_percent(0.70) == 70
    assert risk_percent(1.0) == 100


def test_percent_and_category_agree_everywhere():
    for i in range(10001):
        score = i / 10000
        percent, category = risk_percent(score), risk_category(score)
        expected = "Low" if percent < 40 else "Moderate" if percent < 70 else "High"
        assert category == expected, score
